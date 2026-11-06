/**
 * AI-9 "Truy vết AI": typed client for GET /runs and /runs/:runId of everyinn-agent-core (contracts/agent-core.openapi.json).
 * Every brain turn carries its step trace (what Home did, how, input, output, ms). Door codes / phones are redacted by agent-core.
 */
import { agentApi } from "./agentApi";

export type StepKind = "input" | "stage" | "scenario" | "memory" | "persona" | "route" | "sales" | "prompt" | "llm" | "tool" | "guard" | "template" | "reply" | "error";

export interface RunStep {
  i: number;
  kind: StepKind;
  label: string;
  at: number;
  ms?: number;
  level?: "info" | "warn" | "error";
  input?: unknown;
  output?: unknown;
  note?: string;
}

export interface RunSummary {
  id: string;
  conversationId: string | null;
  senderName: string | null;
  channel: string | null;
  guestText: string | null;
  route: string;
  intent: string | null;
  scenario: string | null;
  summary: string;
  modelId: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  neurons: number | null;
  latencyMs: number | null;
  hasProblem: boolean;
  createdAt: string;
}

export interface RunDetail extends RunSummary {
  toolCalls: Array<{ name: string; args?: Record<string, unknown>; ok?: boolean; summary?: string; ms?: number }>;
  ragChunks: string[];
  steps: RunStep[] | null;
}

export type RunFilter = "all" | "llm" | "fixed" | "problem";

export const traceApi = {
  list: (q: { conversationId?: string | null; filter?: RunFilter; before?: string | null }) => {
    const p = new URLSearchParams();
    if (q.conversationId) p.set("conversationId", q.conversationId);
    if (q.filter === "llm") p.set("route", "llm");
    if (q.filter === "fixed") p.set("route", "faq");
    if (q.filter === "problem") p.set("problem", "1");
    if (q.before) p.set("before", q.before);
    const qs = p.toString();
    return agentApi<{ runs: RunSummary[]; nextBefore: string | null }>(`runs${qs ? `?${qs}` : ""}`).then((r) => r.data!);
  },
  get: (runId: string) => agentApi<{ run: RunDetail }>(`runs/${encodeURIComponent(runId)}`).then((r) => r.data!.run),
};

/** "620 ms" / "12,8 s" */
export const fmtMs = (ms: number | null | undefined) => (ms == null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1).replace(".", ",")} s` : `${ms} ms`);

/** Route → short Vietnamese kind used on run rows. */
export function runKind(r: Pick<RunSummary, "route" | "intent">): string {
  if (r.route === "llm") return "LLM";
  if (r.intent?.startsWith("sales:")) return "Cố định";
  if (r.route === "error") return "Lỗi";
  if (r.route === "guard") return "Chặn";
  return r.route === "greeting" ? "Chào" : "FAQ";
}

/** Flow phases of a turn (node groups of the trace screen). */
export const PHASES = [
  { id: "hieu", label: "Hiểu khách", kinds: ["input", "stage", "scenario", "memory", "persona", "route"] },
  { id: "quyet", label: "Quyết định", kinds: ["sales"] },
  { id: "nghi", label: "Suy nghĩ & gọi tool", kinds: ["prompt", "llm", "tool"] },
  { id: "tra", label: "Kiểm tra & trả lời", kinds: ["guard", "template", "reply", "error"] },
] as const;

export const KIND_META: Record<StepKind, { icon: string; name: string }> = {
  input: { icon: "message-circle", name: "Tin khách" },
  stage: { icon: "user-round", name: "Giai đoạn khách" },
  scenario: { icon: "route", name: "Kịch bản" },
  memory: { icon: "history", name: "Bộ nhớ" },
  persona: { icon: "id-card", name: "Chân dung" },
  route: { icon: "split", name: "Định tuyến" },
  sales: { icon: "shopping-bag", name: "Bán hàng cố định" },
  prompt: { icon: "file-text", name: "Prompt" },
  llm: { icon: "sparkles", name: "LLM" },
  tool: { icon: "wrench", name: "Tool" },
  guard: { icon: "shield-alert", name: "Kiểm tra" },
  template: { icon: "layout-template", name: "Mẫu tin" },
  reply: { icon: "send", name: "Trả lời" },
  error: { icon: "circle-x", name: "Lỗi" },
};
