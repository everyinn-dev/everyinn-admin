/**
 * Allow-list for the /api/agent/* BFF proxy (path shapes + methods) — kept alias-free so node tests import it.
 * Anything not listed returns 404 in the BFF before reaching everyinn-agent-core.
 */
export type AgentMethod = "GET" | "POST" | "PUT" | "DELETE";
type Method = AgentMethod;
const SEG = "[A-Za-z0-9._:-]{3,80}";
export const AGENT_ROUTES: ReadonlyArray<{ method: Method; pattern: RegExp; timeoutMs?: number }> = [
  { method: "GET", pattern: /^settings$/ },
  { method: "PUT", pattern: /^settings$/ },
  { method: "POST", pattern: /^settings\/busy$/ },
  { method: "POST", pattern: /^router\/eval$/ },
  { method: "GET", pattern: /^scenarios\/stats$/ },
  { method: "GET", pattern: /^door-codes$/ },
  { method: "POST", pattern: /^door-codes\/gate$/ },
  { method: "POST", pattern: new RegExp(`^door-codes/gate/${SEG}/deactivate$`) },
  { method: "PUT", pattern: /^door-codes\/lockbox\/[a-z]{3,5}-\d{3}$/ },
  { method: "GET", pattern: new RegExp(`^bookings/${SEG}/door-code$`) },
  { method: "PUT", pattern: new RegExp(`^bookings/${SEG}/door-code$`) },
  { method: "DELETE", pattern: new RegExp(`^bookings/${SEG}/door-code$`) },
  { method: "GET", pattern: /^inbox\/summary$/ },
  { method: "GET", pattern: /^conversations$/ },
  { method: "GET", pattern: new RegExp(`^conversations/${SEG}$`) },
  { method: "DELETE", pattern: new RegExp(`^conversations/${SEG}$`) },
  { method: "GET", pattern: new RegExp(`^conversations/${SEG}/runs$`) },
  { method: "POST", pattern: new RegExp(`^conversations/${SEG}/(takeover|release|messages)$`) },
  { method: "POST", pattern: /^sandbox\/messages$/, timeoutMs: 28_000 },
  { method: "POST", pattern: new RegExp(`^messages/${SEG}/(approve|reject)$`) },
  { method: "GET", pattern: /^escalations$/ },
  { method: "POST", pattern: new RegExp(`^escalations/${SEG}/resolve$`), timeoutMs: 15_000 },
  { method: "GET", pattern: /^checkin-schedules$/ },
  { method: "GET", pattern: new RegExp(`^checkin-schedules/${SEG}/message$`) },
  { method: "POST", pattern: new RegExp(`^checkin-schedules/${SEG}/mark-sent$`) },
  { method: "GET", pattern: /^knowledge\/documents$/ },
  { method: "POST", pattern: /^knowledge\/documents$/ },
  { method: "GET", pattern: new RegExp(`^knowledge/documents/${SEG}$`) },
  { method: "PUT", pattern: new RegExp(`^knowledge/documents/${SEG}$`) },
  { method: "DELETE", pattern: new RegExp(`^knowledge/documents/${SEG}$`) },
  { method: "POST", pattern: new RegExp(`^knowledge/documents/${SEG}/index$`), timeoutMs: 25_000 },
  { method: "GET", pattern: /^faqs$/ },
  { method: "POST", pattern: /^faqs$/ },
  { method: "PUT", pattern: new RegExp(`^faqs/${SEG}$`) },
  { method: "DELETE", pattern: new RegExp(`^faqs/${SEG}$`) },
  // AI-7 W4 master data (Kịch bản, Mẫu tin, Sổ luật, Bảng quyền, Chân dung khách) — registry-driven CRUD
  { method: "GET", pattern: /^md\/_registry$/ },
  { method: "POST", pattern: /^md\/templates\/preview$/ },
  { method: "GET", pattern: /^md\/(scenarios|templates|rules|authority|segments|stay_shifts)$/ },
  { method: "POST", pattern: /^md\/(scenarios|templates|rules|authority|segments|stay_shifts)$/ },
  { method: "PUT", pattern: /^md\/(scenarios|templates|rules|authority|segments|stay_shifts)\/[A-Za-z0-9._:-]{1,64}$/ },
  { method: "DELETE", pattern: /^md\/(scenarios|templates|rules|authority|segments|stay_shifts)\/[A-Za-z0-9._:-]{1,64}$/ },
  { method: "GET", pattern: /^guests$/ },
  { method: "PUT", pattern: /^guests\/(phone|conv)(:|%3A)[A-Za-z0-9%+._:-]{3,110}$/i },
  { method: "GET", pattern: /^authority\/decisions$/ },
  // AI-9 Truy vết AI: brain turns + their step traces
  { method: "GET", pattern: /^runs$/ },
  { method: "GET", pattern: /^runs\/run_[A-Za-z0-9-]{8,64}$/ },
];

export function matchAgentRoute(method: string, path: string) {
  return AGENT_ROUTES.find((r) => r.method === method && r.pattern.test(path)) ?? null;
}

