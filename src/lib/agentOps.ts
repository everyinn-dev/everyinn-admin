/**
 * "Vận hành AI" (AI-7 W4): typed client for the registry-driven master data of everyinn-agent-core
 * (GET /md/_registry → lists + forms; CRUD /md/:collection; guests; authority decisions).
 * The admin renders whatever the registry describes — a new collection or field needs no admin change.
 */
import { agentApi } from "./agentApi";

export type CollectionId = "scenarios" | "templates" | "rules" | "authority" | "segments";
export type FieldType = "string" | "text" | "number" | "boolean" | "enum" | "multi" | "lines" | "time" | "datetime" | "flow";

export interface MdField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  max?: number;
  min?: number;
  options?: string[];
  source?: string;
  help?: string;
  list?: boolean;
}

export interface MdCollection {
  id: CollectionId;
  label: string;
  emoji: string;
  description: string;
  titleField: string;
  fields: MdField[];
  allowCreate: boolean;
  systemLocked?: string[];
}

export interface Capability {
  id: string;
  label: string;
  deciders: Decider[];
  limits: Array<"maxHours" | "maxPercent" | "maxAmount">;
  enforced: boolean;
  help: string;
}

export type Decider = "ai" | "ai_after_timeout" | "manager" | "never";

export interface MdRegistry {
  schemaVersion: number;
  collections: MdCollection[];
  capabilities: Capability[];
  enums: { stages: string[]; layers: string[]; categories: string[]; deciders: Decider[] };
  samples: Record<string, string | number>;
  /** AI-11: kịch bản action library (flow editor) + names of step outcomes. */
  actions?: FlowAction[];
  outcomeLabels?: Record<string, string>;
}

export interface FlowActionParam {
  name: string;
  label: string;
  type: "string" | "text" | "template" | "scenario" | "lines" | "number" | "boolean";
  required?: boolean;
}
export interface FlowAction {
  id: string;
  label: string;
  help: string;
  params: FlowActionParam[];
  outcomes: string[];
  /** the step stops and waits for the guest / quản lí */
  waits: boolean;
}
export interface FlowStep {
  id: string;
  action: string;
  title?: string;
  params?: Record<string, unknown>;
  next?: Record<string, string>;
}
export interface ScenarioStat {
  scenario: string;
  runs7d: number;
  waiting: number;
  lastAt: string | null;
}

export type MdData = Record<string, unknown>;

export interface MdRow<T extends MdData = MdData> {
  id: string;
  data: T;
  isActive: boolean;
  isSystem: boolean;
  sort: number;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export interface GuestProfile {
  id: string;
  phoneMasked: string | null;
  conversationId: string | null;
  name: string | null;
  tags: string[];
  note: string | null;
  stats: { stays?: number; noShows?: number; cancels?: number; spend?: number; tier?: string | null; lastStayAt?: string | null } | null;
  statsAt: string | null;
  segment: string | null;
  version: number;
  updatedAt: string;
}

export interface DecisionAgg {
  capability: string;
  segment: string;
  approved: number;
  deal: number;
  rejected: number;
  auto: number;
  refused: number;
  maxHours: number | null;
  maxAmount: number | null;
}

export interface DelegationSuggestion {
  capability: string;
  segment: string;
  maxHours: number | null;
  approvals: number;
}

export const opsApi = {
  registry: () => agentApi<MdRegistry>("md/_registry").then((r) => r.data!),
  list: <T extends MdData>(c: CollectionId) => agentApi<{ rows: MdRow<T>[] }>(`md/${c}`).then((r) => r.data!.rows),
  create: (c: CollectionId, body: { id?: string; data: MdData; isActive?: boolean; sort?: number }) =>
    agentApi<{ row: MdRow }>(`md/${c}`, { method: "POST", body }).then((r) => r.data!.row),
  update: (c: CollectionId, id: string, body: { data?: MdData; isActive?: boolean; sort?: number; expectedVersion: number }) =>
    agentApi<{ row: MdRow }>(`md/${c}/${encodeURIComponent(id)}`, { method: "PUT", body }).then((r) => r.data!.row),
  remove: (c: CollectionId, id: string) => agentApi<{ ok: boolean }>(`md/${c}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  guests: (q: { segment?: string; q?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as Array<[string, string]>).toString();
    return agentApi<{ guests: GuestProfile[] }>(`guests${qs ? `?${qs}` : ""}`).then((r) => r.data!.guests);
  },
  updateGuest: (id: string, body: { tags?: string[]; note?: string | null; expectedVersion: number }) =>
    agentApi<{ guest: GuestProfile }>(`guests/${encodeURIComponent(id)}`, { method: "PUT", body }).then((r) => r.data!.guest),
  scenarioStats: () => agentApi<{ since: string; stats: ScenarioStat[] }>("scenarios/stats").then((r) => r.data!.stats),
  decisions: (days = 30) => agentApi<{ days: number; summary: DecisionAgg[]; suggestions: DelegationSuggestion[] }>(`authority/decisions?days=${days}`).then((r) => r.data!),
};

// ── Vietnamese labels for registry enum values (unknown values fall back to the raw id) ──────────
export const LAYER_LABEL: Record<string, string> = { policy: "Chính sách", convention: "Quy ước", exception: "Ngoại lệ" };
export const CATEGORY_LABEL: Record<string, string> = {
  booking: "Đặt phòng",
  payment: "Thanh toán",
  pricing: "Giá",
  checkin: "Nhận phòng",
  stay: "Lưu trú",
  house_rules: "Nội quy",
  incident: "Sự cố",
  communication: "Giao tiếp",
  other: "Khác",
};
export const STAGE_LABEL: Record<string, string> = { new: "Khách mới", returning: "Khách cũ", upcoming: "Sắp đến", in_stay: "Đang ở" };
/** AI-11 kịch bản "Khi nào": what the guest is doing / where the conversation is. */
export const ACT_LABEL: Record<string, string> = {
  rebook: "Muốn đặt lại / thanh toán tiếp",
  paid: "Báo đã chuyển tiền",
  lost_item: "Để quên đồ",
  claim: "Nói về lời hứa / việc trước đây",
  cancel: "Huỷ",
  pay_later: "Hẹn chuyển sau",
  book: "Muốn đặt phòng",
  ask_price: "Hỏi giá",
  ask_directions: "Hỏi đường",
  ask_door: "Hỏi cách mở cửa",
  in_stay_issue: "Báo sự cố khi đang ở",
  special_occasion: "Dịp đặc biệt (sinh nhật, kỷ niệm…)",
  other: "Khác",
};
export const PHASE_LABEL: Record<string, string> = { browsing: "Đang tư vấn", confirming: "Đang xác nhận", awaiting_payment: "Chờ chuyển khoản", paid: "Đã có booking", lapsed: "Vừa hết giờ giữ" };
export const DECIDER_LABEL: Record<Decider, string> = { ai: "Home tự chốt", ai_after_timeout: "Chờ 11′ → Home", manager: "Hỏi quản lí", never: "Không bao giờ" };
export const DECIDER_SHORT: Record<Decider, string> = { ai: "Home", ai_after_timeout: "Chờ→Home", manager: "Quản lí", never: "Không" };
export const DAY_LABEL: Record<string, string> = { "1": "T2", "2": "T3", "3": "T4", "4": "T5", "5": "T6", "6": "T7", "0": "CN" };
export const TIER_LABEL: Record<string, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

/** "seed" / "staff:12" / free text → who edited the row, for "Sửa bởi …". */
export function editorLabel(by: string | null, myStaffId?: number | null): string {
  if (!by || by === "seed") return "Hệ thống · mẫu ban đầu";
  const m = /^staff:(\d+)$/.exec(by);
  if (m) return myStaffId && Number(m[1]) === myStaffId ? "Bạn" : `Nhân viên #${m[1]}`;
  if (by.startsWith("owner-decision")) return "Quản lí";
  return by === "system" ? "Hệ thống" : by;
}

/** Fill {placeholders} with sample values; unknown ones stay visible so the editor sees the typo. */
export function fillTemplate(text: string, values: Record<string, string | number>): Array<{ text: string; kind: "plain" | "filled" | "unknown" }> {
  const out: Array<{ text: string; kind: "plain" | "filled" | "unknown" }> = [];
  let last = 0;
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), kind: "plain" });
    const v = values[m[1]];
    out.push(v != null ? { text: String(v), kind: "filled" } : { text: m[0], kind: "unknown" });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: "plain" });
  return out;
}

/** "06/11 01:29" in VN time. */
export function fmtVn(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
