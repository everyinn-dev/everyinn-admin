/**
 * AI-11 flow editor model — pure helpers (no React): what a step can lead to, its one-line summary, the checklist
 * (mirror of agent-core workflow/validate.ts — the server re-checks on save), and list edits.
 */
import type { FlowAction, FlowStep, MdRow } from "@/lib/agentOps";

export const END = "end";
export const LLM = "llm";

export const ACTION_ICON: Record<string, string> = {
  send_template: "message-square-text",
  ask_guest: "message-circle-question",
  notify_owner: "bell-ring",
  investigate: "search",
  ask_both: "users",
  synthesize: "sparkles",
  rebook: "rotate-ccw",
  goto_scenario: "corner-down-right",
  ask_llm: "bot",
  end: "flag",
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
export const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split("\n") : []).map((x) => x.trim()).filter(Boolean);

/** Outcomes a step can branch on (button:i become the step's button labels). */
export function outcomesOf(step: FlowStep, action: FlowAction | undefined, labels: Record<string, string>): Array<{ key: string; label: string }> {
  if (!action) return [];
  const buttons = lines(step.params?.buttons);
  const out: Array<{ key: string; label: string }> = [];
  // notify_owner: with "wait" the step only ends by the quản lí's answer; without it, it only "sent"
  const waits = step.action !== "notify_owner" || !!step.params?.wait;
  for (const o of action.outcomes) {
    if (step.action === "notify_owner" && (waits ? o === "sent" : o !== "sent")) continue;
    if (o.startsWith("button:")) {
      const i = Number(o.slice(7));
      if (buttons[i]) out.push({ key: o, label: `Quản lí bấm “${buttons[i]}”` });
      continue;
    }
    out.push({ key: o, label: labels[o] ?? o });
  }
  return out;
}

/** Where an outcome goes: explicit next, then "*", then the following step. */
export function targetOf(flow: FlowStep[], i: number, outcome: string): string {
  const s = flow[i];
  const n = s.next?.[outcome] ?? s.next?.["*"];
  if (n) return n;
  if (s.action === "end") return END;
  if (s.action === "ask_llm") return LLM;
  return flow[i + 1]?.id ?? END;
}

export function targetLabel(flow: FlowStep[], target: string, scenarios: MdRow[]): string {
  if (target === END) return "Kết thúc";
  if (target === LLM) return "Home tự trả lời";
  if (target.startsWith("scenario:")) {
    const r = scenarios.find((x) => x.id === target.slice(9));
    return `Kịch bản “${str(r?.data.title) || target.slice(9)}”`;
  }
  const i = flow.findIndex((s) => s.id === target);
  return i >= 0 ? `${i + 1}. ${flow[i].title || target}` : `“${target}” (không có)`;
}

/** One line under a node: what the step says / does. */
export function summaryOf(step: FlowStep, action: FlowAction | undefined, templates: MdRow[], scenarios: MdRow[]): string {
  const p = step.params ?? {};
  const tplText = (key: string) => {
    const t = templates.find((x) => str(x.data.key) === key && x.data.lang !== "en");
    const v = t && Array.isArray(t.data.variants) ? String(t.data.variants[0] ?? "") : "";
    return v ? `“${v.replace(/\n/g, " ")}”` : `mẫu ${key}`;
  };
  if (p.template) return tplText(str(p.template));
  if (p.text) return `“${str(p.text)}”`;
  if (p.goal) return str(p.goal);
  if (p.title) return `Thẻ: ${str(p.title)}`;
  if (p.hint) return str(p.hint);
  if (p.scenario) return targetLabel([], `scenario:${str(p.scenario)}`, scenarios);
  return action?.help ?? "";
}

export interface Issue {
  stepId: string | null;
  text: string;
}

/** Same rules as the server (workflow/validate.ts) so the owner sees problems before saving. */
export function checklist(flow: FlowStep[], actions: FlowAction[], templateKeys: string[], scenarioIds: string[]): Issue[] {
  const out: Issue[] = [];
  const ids = new Set(flow.map((s) => s.id));
  flow.forEach((s, i) => {
    const a = actions.find((x) => x.id === s.action);
    const n = `Bước ${i + 1}`;
    if (!a) return out.push({ stepId: s.id, text: `${n}: chưa chọn hành động` });
    for (const p of a.params) {
      const v = s.params?.[p.name];
      const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
      if (p.required && empty) out.push({ stepId: s.id, text: `${n}: thiếu “${p.label}”` });
      if (!empty && p.type === "template" && !templateKeys.includes(String(v))) out.push({ stepId: s.id, text: `${n}: mẫu tin “${String(v)}” không có` });
    }
    if ((s.action === "send_template" || s.action === "ask_guest") && !s.params?.template && !s.params?.text) out.push({ stepId: s.id, text: `${n}: chọn mẫu tin hoặc viết câu` });
    for (const [o, t] of Object.entries(s.next ?? {})) {
      if (t === END || t === LLM) continue;
      if (t.startsWith("scenario:") ? !scenarioIds.includes(t.slice(9)) : !ids.has(t)) out.push({ stepId: s.id, text: `${n}: nhánh “${o}” trỏ tới chỗ không có` });
    }
  });
  const seen = new Set<string>();
  const stack = flow.length ? [flow[0].id] : [];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const i = flow.findIndex((s) => s.id === id);
    const s = flow[i];
    const ts = Object.values(s.next ?? {}).filter((t) => ids.has(t));
    if ((!s.next || !("*" in s.next)) && flow[i + 1] && !["end", "goto_scenario", "ask_llm"].includes(s.action)) ts.push(flow[i + 1].id);
    stack.push(...ts);
  }
  flow.forEach((s, i) => {
    if (!seen.has(s.id)) out.push({ stepId: s.id, text: `Bước ${i + 1} không bao giờ tới được (không nhánh nào dẫn tới)` });
  });
  return out;
}

export function newStepId(flow: FlowStep[]): string {
  for (let i = flow.length + 1; ; i++) if (!flow.some((s) => s.id === `b${i}`)) return `b${i}`;
}

export function insertStep(flow: FlowStep[], at: number, action: FlowAction): FlowStep[] {
  const step: FlowStep = { id: newStepId(flow), action: action.id, title: action.label, params: {} };
  return [...flow.slice(0, at), step, ...flow.slice(at)];
}

/** Removing a step: branches that pointed at it fall back to "the following step". */
export function removeStep(flow: FlowStep[], id: string): FlowStep[] {
  return flow
    .filter((s) => s.id !== id)
    .map((s) => {
      if (!s.next) return s;
      const next = Object.fromEntries(Object.entries(s.next).filter(([, t]) => t !== id));
      return { ...s, next: Object.keys(next).length ? next : undefined };
    });
}

export function moveStep(flow: FlowStep[], i: number, d: -1 | 1): FlowStep[] {
  const j = i + d;
  if (j < 0 || j >= flow.length) return flow;
  const f = [...flow];
  [f[i], f[j]] = [f[j], f[i]];
  return f;
}
