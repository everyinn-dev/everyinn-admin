/**
 * Browser client for /api/agent/* (BFF proxy → everyinn-agent-core AdminApi).
 * Shapes follow contracts/agent-core.openapi.json (synced from everyinn-agent-core).
 */
import { apiFetch } from "./apiClient";

export class AgentApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

export interface AgentResult<T> {
  status: number;
  data: T | null;
  etag: string | null;
}

export async function agentApi<T>(path: string, init: { method?: string; body?: unknown; etag?: string | null } = {}): Promise<AgentResult<T>> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.etag) headers["if-none-match"] = init.etag;
  const res = await apiFetch(`/api/agent/${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 304) return { status: 304, data: null, etag: init.etag ?? null };
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error ?? `Lỗi ${res.status}`;
    throw new AgentApiError(typeof msg === "string" ? msg : "Lỗi hệ thống", res.status, (json as { code?: string } | null)?.code);
  }
  return { status: res.status, data: json as T, etag: res.headers.get("etag") };
}

// ── Types (subset of the AdminApi contract) ─────────────────────────────────────────────────
export type ConversationMode = "AI_ACTIVE" | "PENDING_PAYMENT_CONFIRM" | "PENDING_OWNER" | "HUMAN_TAKEOVER";

export interface AgentConversation {
  id: string;
  channel: "sandbox" | "facebook" | "instagram";
  senderName: string;
  senderHandle: string | null;
  phone: string | null;
  loyaltyTier: string | null;
  mode: ConversationMode;
  takeover: { staffId: number; staffName: string | null; until: string } | null;
  activeHoldId: string | null;
  activeBookingId: string | null;
  unreadCount: number;
  pendingCount: number;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  version: number;
}

export interface AgentMessage {
  id: string;
  senderType: "guest" | "ai" | "staff" | "system";
  staff: { id: number; name: string | null } | null;
  status: "received" | "draft_pending_approval" | "sending" | "sent" | "failed" | "rejected";
  text: string;
  attachments: AgentAttachment[];
  aiRunId: string | null;
  /** Guest unsent the message (Meta) — text is empty. */
  deletedAt?: string | null;
  createdAt: string;
}

export interface AgentCard {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  url?: string;
  buttons?: Array<{ type: "web_url"; title: string; url: string } | { type: "postback"; title: string; payload: string }>;
}

export type AgentAttachment =
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string }
  | { type: "cards"; cards: AgentCard[] }
  | { type: "quick_replies"; options: string[] };

export interface AgentEscalation {
  id: string;
  conversationId: string | null;
  type: "CONFIRM_HOLD_PAYMENT" | "REQUEST_DOOR_CODE" | "PRICE_NEGOTIATION" | "FACILITY_ISSUE" | "GENERAL_HELP" | "CHECKIN_REMINDER";
  severity: "normal" | "high" | "critical";
  holdId: string | null;
  bookingId: string | null;
  roomId: string | null;
  summary: string;
  details: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  intent: string;
  route: string;
  ragChunks: string[];
  toolCalls: Array<{ name: string; args: Record<string, unknown>; ok: boolean; summary: string; ms: number }>;
  summary: string;
  modelId: string | null;
  tokensIn: number;
  tokensOut: number;
  neurons: number;
  latencyMs: number;
  createdAt: string;
}

export interface AgentSettings {
  botName: string;
  personaPrompt: string;
  modelId: string;
  supervisedMode: boolean;
  busyUntil: string | null;
  quietHours: { enabled: boolean; start: string; end: string; holdBufferMinutes: number };
  busy: { active: boolean; reason: "quiet_hours" | "manual" | null; until: string | null };
  busyAutoReplyTemplate: string;
  checkinMessageTemplate: string;
  hotline: string;
  maxDiscountPercent: number;
  defaultHoldMinutes: number;
  depositPercent: number;
  /** AI-7 OD-25: deposit allowed only when booked at least this many days ahead (else full payment). */
  depositMinLeadDays: number;
  /** Wait this long (default 30 s) for more short messages before Home answers (0 = off); full questions are answered at once. */
  burstWaitSeconds: number;
  takeoverMinutes: number;
  autoCheckinWindowHours: number;
  manualReminderLeadHours: number;
  dailyNeuronBudget: number;
  toolSwitches: Record<string, boolean>;
  telegramStaffMap: Record<string, { staffId: number; role: "manager" | "receptionist"; name: string }>;
  /** AR-2: who the AI answers on Facebook/Instagram (allowlist = everyone else is ignored and not stored). */
  metaAccess: {
    mode: "allowlist" | "open";
    facebook: { names: string[]; ids: string[] };
    instagram: { usernames: string[]; ids: string[] };
  };
  version: number;
}

export const MODE_META: Record<ConversationMode, { label: string; cls: string }> = {
  AI_ACTIVE: { label: "🟢 AI đang trực", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  PENDING_PAYMENT_CONFIRM: { label: "🟡 Đợi xác nhận CK", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  PENDING_OWNER: { label: "🟡 Chờ sếp duyệt", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  HUMAN_TAKEOVER: { label: "🔴 Sếp đang trực", cls: "bg-rose-50 text-rose-800 border-rose-200" },
};

export const formatVnTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

export const formatVnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;

export const ROOMS = [
  { id: "haven-101", label: "Haven 101" },
  { id: "sig-102", label: "Signature 102" },
  { id: "haven-201", label: "Haven 201" },
  { id: "sig-202", label: "Signature 202" },
  { id: "haven-301", label: "Haven 301" },
  { id: "sig-302", label: "Signature 302" },
];
