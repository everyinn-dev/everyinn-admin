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
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "CoreError";
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
}

export interface CoreResponse<T> {
  status: number;
  /** `null` for 304 Not Modified. */
  data: T | null;
  etag: string | null;
  requestId: string | null;
}

async function binding(core: CoreName): Promise<Fetcher> {
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

export async function callCore<T>(core: CoreName, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, opts: CoreCallOptions): Promise<CoreResponse<T>> {
  const svc = await binding(core);
  const url = new URL(`https://${core}-core.internal${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const requestId = crypto.randomUUID();
  const headers = new Headers({
    accept: "application/json",
    "x-ei-caller": "admin-bff",
    "x-ei-actor-id": String(opts.staff.id),
    "x-ei-actor-role": opts.staff.role,
    "x-ei-actor-name": encodeURIComponent(opts.staff.full_name ?? ""),
    "x-request-id": requestId,
    "x-correlation-id": opts.correlationId ?? requestId,
  });
  if (opts.idempotencyKey) headers.set("idempotency-key", opts.idempotencyKey);
  if (opts.ifNoneMatch) headers.set("if-none-match", opts.ifNoneMatch);
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await svc.fetch(url.toString(), { method, headers, body });
  } catch (err) {
    throw new CoreError(503, "CORE_UNAVAILABLE", `Không gọi được ${core}-core: ${err instanceof Error ? err.message : "unknown"}`, undefined, requestId);
  }

  const etag = res.headers.get("etag");
  const rid = res.headers.get("x-request-id") ?? requestId;
  if (res.status === 304) return { status: 304, data: null, etag, requestId: rid };

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new CoreError(502, "CORE_BAD_RESPONSE", `${core}-core trả về dữ liệu không phải JSON.`, undefined, rid);
    }
  }
  if (!res.ok) {
    const e = (json as CoreErrorBody | null)?.error;
    throw new CoreError(res.status, e?.code ?? "CORE_ERROR", e?.message ?? `${core}-core lỗi ${res.status}`, e?.details, rid);
  }
  return { status: res.status, data: json as T, etag, requestId: rid };
}

export const bookingCore = {
  get: <T>(path: string, o: CoreCallOptions) => callCore<T>("booking", "GET", path, o),
  post: <T>(path: string, o: CoreCallOptions) => callCore<T>("booking", "POST", path, o),
  patch: <T>(path: string, o: CoreCallOptions) => callCore<T>("booking", "PATCH", path, o),
  put: <T>(path: string, o: CoreCallOptions) => callCore<T>("booking", "PUT", path, o),
};

export const cdpCore = {
  get: <T>(path: string, o: CoreCallOptions) => callCore<T>("cdp", "GET", path, o),
  post: <T>(path: string, o: CoreCallOptions) => callCore<T>("cdp", "POST", path, o),
  patch: <T>(path: string, o: CoreCallOptions) => callCore<T>("cdp", "PATCH", path, o),
};

/** Map a Core error to the `{ error }` JSON shape the existing Admin UI already consumes. */
export function coreErrorResponse(err: unknown): Response {
  if (err instanceof CoreError) {
    return Response.json({ error: err.message, code: err.code, details: err.details, requestId: err.requestId }, { status: err.status });
  }
  console.error("Unexpected BFF error:", err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

