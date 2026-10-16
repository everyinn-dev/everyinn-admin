/**
 * Admin BFF → Core clients (EI-OTA-ARCH-001 §12).
 *
 * Booking and CDP data is owned by `everyinn-booking-core` / `everyinn-cdp-core`. Admin only talks to them
 * over Service Bindings (no public URL, no raw D1). Staff authentication stays in Admin (JWT); the minimal
 * actor context is forwarded so the Cores can enforce role-based commands and audit.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Staff } from "@/types";

export type CoreName = "booking" | "cdp";

/** Service Binding names (wrangler `services[].binding`). */
const BINDING: Record<CoreName, string> = { booking: "BOOKING_CORE", cdp: "CDP_CORE" };

export interface CoreErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
  requestId?: string;
}

export class CoreError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    requestId?: string
  ) {
    super(message);
    this.name = "CoreError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export interface CoreCallOptions {
  staff: Pick<Staff, "id" | "role" | "full_name">;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  /** Required for every mutating Booking Core command (§10.1). */
  idempotencyKey?: string;
  ifNoneMatch?: string | null;
  correlationId?: string;
  timeoutMs?: number;
}

export interface CoreResponse<T> {
  status: number;
  /** `null` for 304 Not Modified. */
  data: T | null;
  etag: string | null;
  requestId: string | null;
}

let testFetcher: ((core: CoreName) => Promise<Fetcher> | Fetcher) | null = null;

/** Override Service Binding fetcher for unit/integration tests. Set to null to restore. */
export function setTestFetcher(fn: ((core: CoreName) => Promise<Fetcher> | Fetcher) | null): void {
  testFetcher = fn;
}

async function binding(core: CoreName): Promise<Fetcher> {
  if (testFetcher) {
    return await testFetcher(core);
  }
  const ctx = await getCloudflareContext({ async: true });
  const svc = (ctx.env as unknown as Record<string, Fetcher | undefined>)[BINDING[core]];
  if (!svc) {
    // §21.4: a missing binding is a hard failure — never fall back to raw D1.
    throw new CoreError(503, "CORE_BINDING_MISSING", `Service Binding ${BINDING[core]} chưa được cấu hình.`);
  }
  return svc;
}

/** Idempotency keys for a user intent: stable per (action, subject, intent id) so double-clicks/retries replay. */
export function newIdempotencyKey(action: string): string {
  return `adm.${action}.${crypto.randomUUID()}`.slice(0, 128);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskPii(str: string): string {
  return str.replace(/(\+?84|0[35789])\d{8}/g, (phone) => {
    return phone.slice(0, 2) + "******" + phone.slice(-2);
  });
}

export async function callCore<T>(
  core: CoreName,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  opts: CoreCallOptions
): Promise<CoreResponse<T>> {
  const svc = await binding(core);
  const url = new URL(`https://${core}-core.internal${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const requestId = crypto.randomUUID();
  const correlationId = opts.correlationId ?? requestId;
  const headers = new Headers({
    accept: "application/json",
    "x-ei-caller": "admin-bff",
    "x-ei-actor-id": String(opts.staff.id),
    "x-ei-actor-role": opts.staff.role,
    "x-ei-actor-name": encodeURIComponent(opts.staff.full_name ?? ""),
    "x-request-id": requestId,
    "x-correlation-id": correlationId,
  });
  if (opts.idempotencyKey) headers.set("idempotency-key", opts.idempotencyKey);
  if (opts.ifNoneMatch) headers.set("if-none-match", opts.ifNoneMatch);
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.body);
  }

  const isIdempotent = method === "GET" || Boolean(opts.idempotencyKey);
  const maxAttempts = isIdempotent ? 3 : 1;
  const timeoutMs = opts.timeoutMs ?? 8000;

  let lastError: unknown = null;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response | null = null;
    let text = "";
    let fetchError: Error | null = null;

    try {
      const signal = AbortSignal.timeout(timeoutMs);
      res = await svc.fetch(url.toString(), { method, headers, body, signal });
    } catch (err: any) {
      fetchError = err instanceof Error ? err : new Error(String(err));
    }

    if (fetchError || !res) {
      const isTimeout = fetchError?.name === "TimeoutError" || fetchError?.message?.includes("timed out");
      const errMessage = isTimeout
        ? `${core}-core quá thời gian phản hồi (${timeoutMs}ms)`
        : `Không gọi được ${core}-core: ${fetchError?.message ?? "unknown"}`;
      lastError = new CoreError(503, "CORE_UNAVAILABLE", errMessage, undefined, requestId);

      if (attempt < maxAttempts) {
        const backoff = attempt === 1 ? 200 + Math.floor(Math.random() * 50) : 600 + Math.floor(Math.random() * 100);
        await sleep(backoff);
        continue;
      }
      break;
    }

    // Check if status is a retryable gateway/service error (502, 503, 504)
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      if (attempt < maxAttempts) {
        const backoff = attempt === 1 ? 200 + Math.floor(Math.random() * 50) : 600 + Math.floor(Math.random() * 100);
        await sleep(backoff);
        continue;
      }
    }

    const etag = res.headers.get("etag");
    const rid = res.headers.get("x-request-id") ?? requestId;
    const durationMs = Date.now() - startTime;

    if (res.status === 304) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          worker: "everyinn-admin",
          env: process.env.NODE_ENV || "development",
          requestId: rid,
          correlationId,
          caller: "admin-bff",
          targetCore: core,
          method,
          route: maskPii(path),
          status: 304,
          ms: durationMs,
          attempts: attempt,
        })
      );
      return { status: 304, data: null, etag, requestId: rid };
    }

    try {
      text = await res.text();
    } catch {
      text = "";
    }

    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        const parseErr = new CoreError(502, "CORE_BAD_RESPONSE", `${core}-core trả về dữ liệu không phải JSON.`, undefined, rid);
        console.log(
          JSON.stringify({
            ts: new Date().toISOString(),
            worker: "everyinn-admin",
            env: process.env.NODE_ENV || "development",
            requestId: rid,
            correlationId,
            caller: "admin-bff",
            targetCore: core,
            method,
            route: maskPii(path),
            status: 502,
            ms: durationMs,
            attempts: attempt,
            err: parseErr.message,
          })
        );
        throw parseErr;
      }
    }

    if (!res.ok) {
      const e = (json as CoreErrorBody | null)?.error;
      const coreErr = new CoreError(
        res.status,
        e?.code ?? "CORE_ERROR",
        e?.message ?? `${core}-core lỗi ${res.status}`,
        e?.details,
        rid
      );
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          worker: "everyinn-admin",
          env: process.env.NODE_ENV || "development",
          requestId: rid,
          correlationId,
          caller: "admin-bff",
          targetCore: core,
          method,
          route: maskPii(path),
          status: res.status,
          ms: durationMs,
          attempts: attempt,
          err: coreErr.code,
        })
      );
      throw coreErr;
    }

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        worker: "everyinn-admin",
        env: process.env.NODE_ENV || "development",
        requestId: rid,
        correlationId,
        caller: "admin-bff",
        targetCore: core,
        method,
        route: maskPii(path),
        status: res.status,
        ms: durationMs,
        attempts: attempt,
      })
    );
    return { status: res.status, data: json as T, etag, requestId: rid };
  }

  const durationMs = Date.now() - startTime;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      worker: "everyinn-admin",
      env: process.env.NODE_ENV || "development",
      requestId,
      correlationId,
      caller: "admin-bff",
      targetCore: core,
      method,
      route: maskPii(path),
      status: (lastError as any)?.status ?? 503,
      ms: durationMs,
      attempts: maxAttempts,
      err: (lastError as any)?.message ?? "CORE_UNAVAILABLE",
    })
  );
  throw lastError || new CoreError(503, "CORE_UNAVAILABLE", `Không gọi được ${core}-core sau ${maxAttempts} lần thử.`, undefined, requestId);
}

export const bookingCore = {
  get: <T>(path: string, o: CoreCallOptions) => callCore<T>("booking", "GET", path, o),
  post: <T>(path: string, o: CoreCallOptions) => callCore<T>("booking", "POST", path, o),
  patch: <T>(path: string, o: CoreCallOptions) => callCore<T>("booking", "PATCH", path, o),
  put: <T>(path: string, o: CoreCallOptions) => callCore<T>("booking", "PUT", path, o),
  delete: <T>(path: string, o: CoreCallOptions) => callCore<T>("booking", "DELETE", path, o),
};

export const cdpCore = {
  get: <T>(path: string, o: CoreCallOptions) => callCore<T>("cdp", "GET", path, o),
  post: <T>(path: string, o: CoreCallOptions) => callCore<T>("cdp", "POST", path, o),
  patch: <T>(path: string, o: CoreCallOptions) => callCore<T>("cdp", "PATCH", path, o),
  put: <T>(path: string, o: CoreCallOptions) => callCore<T>("cdp", "PUT", path, o),
  delete: <T>(path: string, o: CoreCallOptions) => callCore<T>("cdp", "DELETE", path, o),
};

/** Map a Core error to the `{ error }` JSON shape the existing Admin UI already consumes. */
export function coreErrorResponse(err: unknown): Response {
  if (err instanceof CoreError) {
    return Response.json({ error: err.message, code: err.code, details: err.details, requestId: err.requestId }, { status: err.status });
  }
  console.error("Unexpected BFF error:", err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

