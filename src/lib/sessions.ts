/**
 * LSB-5 — the admin wizard books through the SAME booking-session engine as the guest landing page
 * (everyinn-agent-core AdminApi /internal/v1/sessions, channel "admin"). Booking Core answers 409 SESSION_MANAGED
 * to direct hold writes of such holds, so every write here goes through agent-core; reads of the hold DTO stay on
 * Booking Core (the wizard UI keeps its hold-shaped state).
 */
import { agentCore, bookingCore } from "./cores.ts";
import type { Staff } from "@/types";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;
/** the client's Idempotency-Key header when well-formed (forwarded to agent-core), else undefined */
export const clientIdemKey = (req: Request): string | undefined => {
  const k = req.headers.get("idempotency-key")?.trim();
  return k && IDEMPOTENCY_KEY_RE.test(k) ? k : undefined;
};

/** public landing origin for the guest payment link (wrangler var LANDING_BASE_URL per env) */
export async function landingBaseUrl(): Promise<string> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const v = (env as unknown as Record<string, string | undefined>).LANDING_BASE_URL;
    if (v) return v.replace(/\/$/, "");
  } catch {
    // local Node / tests
  }
  return (process.env.LANDING_BASE_URL ?? "https://everyinn.vn").replace(/\/$/, "");
}

type StaffRef = Pick<Staff, "id" | "role" | "full_name">;

export interface SessionDetail {
  token?: string;
  session: {
    id: string;
    ref: string;
    holdId: string;
    status: string;
    statusLabel: string;
    amountDue: number;
    paidAmount: number;
    remaining: number;
    bookingId: string | null;
    expiresAt: string;
    payment: { amount: number; reference: string; qrUrl: string | null; bankId: string | null; account: string | null; holderName: string | null } | null;
    version: number;
    [k: string]: unknown;
  };
  events: { id: number; event: string; accepted: boolean; actor: { name: string | null }; source: string; at: string }[];
  payments: { id: string; amount: number; method: string; source: string; staffName: string | null; at: string }[];
}

export async function sessionIdForHold(staff: StaffRef, holdId: string): Promise<string> {
  const r = await agentCore.get<{ sessionId: string }>(`/internal/v1/sessions/by-hold/${encodeURIComponent(holdId)}`, { staff });
  return r.data!.sessionId;
}

export async function holdOf(staff: StaffRef, holdId: string) {
  return (await bookingCore.get<{ hold: unknown }>(`/internal/v1/holds/${encodeURIComponent(holdId)}`, { staff })).data!.hold;
}

export const sessions = {
  create: (staff: StaffRef, body: Record<string, unknown>) => agentCore.post<SessionDetail>("/internal/v1/sessions", { staff, body }),
  get: (staff: StaffRef, id: string, ifNoneMatch?: string | null) => agentCore.get<SessionDetail>(`/internal/v1/sessions/${encodeURIComponent(id)}`, { staff, ifNoneMatch }),
  save: (staff: StaffRef, id: string, body: Record<string, unknown>) => agentCore.patch<SessionDetail>(`/internal/v1/sessions/${encodeURIComponent(id)}`, { staff, body }),
  /** `idempotencyKey`: one per staff press — agent-core dedupes a double-clicked "Đã nhận" on it (one payment row). */
  action: (staff: StaffRef, id: string, action: "confirm" | "reject" | "revoke" | "accept-short" | "request-topup" | "restore" | "share-link" | "payments" | "preview", body: Record<string, unknown> = {}, idempotencyKey?: string) =>
    agentCore.post<SessionDetail & { token?: string; path?: string }>(`/internal/v1/sessions/${encodeURIComponent(id)}/${action}`, { staff, body, ...(idempotencyKey ? { idempotencyKey } : {}) }),
  list: (staff: StaffRef, query: Record<string, string | undefined>, ifNoneMatch?: string | null) => agentCore.get<{ sessions: Record<string, unknown>[] }>("/internal/v1/sessions", { staff, query, ifNoneMatch }),
};
