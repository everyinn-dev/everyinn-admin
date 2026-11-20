/**
 * Booking ledger ("Sổ thu tiền") — EI-FINANCE-ONTOLOGY-001 §3, §8. Money movements are append-only in Booking
 * Core; the admin only records what actually happened (amount, method, WHEN it moved) and corrects by new entries.
 * Pure: shared by the BFF route (validation → Core payload) and the drawer section (labels, balances).
 */
import { vnLocalInputToIso } from "./vnTime.ts";

export const LEDGER_ACTIONS = ["payment", "refund", "adjustment", "reverse", "transfer"] as const;
export type LedgerAction = (typeof LEDGER_ACTIONS)[number];

export const PAYMENT_METHODS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "bank_transfer", label: "Chuyển khoản" },
  { value: "card", label: "Thẻ" },
  { value: "ewallet", label: "Ví điện tử" },
  { value: "other", label: "Khác" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export interface LedgerEntry {
  id: string;
  entryType: "deposit" | "payment" | "refund" | "adjustment" | "reversal";
  bucket: "received" | "refunded";
  /** Signed: + received, − returned. */
  amount: number;
  method: string;
  reference: string | null;
  reason: string | null;
  reversesEntryId: string | null;
  actor: { id: number; name: string | null } | null;
  occurredAt: string;
  createdAt: string;
  externalRef?: string | null;
  /** B10: both legs of a transfer between bookings share it. */
  transferId?: string | null;
  counterpartBookingId?: string | null;
}

export const ENTRY_LABELS: Record<LedgerEntry["entryType"], string> = {
  deposit: "Cọc",
  payment: "Thu tiền",
  refund: "Hoàn tiền",
  adjustment: "Điều chỉnh",
  reversal: "Đảo bút toán",
};

export const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;

/** "Chuyển sang đơn X" / "Nhận từ đơn X" for transfer legs, the plain type label otherwise. */
export function entryLabel(e: LedgerEntry): string {
  if (e.transferId && e.counterpartBookingId) return e.amount < 0 ? `Chuyển sang đơn ${e.counterpartBookingId}` : `Nhận từ đơn ${e.counterpartBookingId}`;
  return ENTRY_LABELS[e.entryType];
}

/** Each entry is reversible once; a reversal itself is not; a transfer leg never alone (transfer back instead). */
export function canReverse(entry: LedgerEntry, all: readonly LedgerEntry[]): boolean {
  return entry.entryType !== "reversal" && !entry.transferId && !all.some((e) => e.reversesEntryId === entry.id);
}

export interface LedgerBalance {
  netReceived: number;
  /** Still to collect on a live booking. */
  due: number;
  /** Held above the booking value — owed back to the guest (never hidden). */
  overpaid: number;
}

export function balanceOf(b: { totalPrice: number; paidAmount?: number | null; refundAmount?: number | null; status?: string }): LedgerBalance {
  const netReceived = (b.paidAmount ?? 0) - (b.refundAmount ?? 0);
  const live = b.status !== "cancelled" && b.status !== "no_show";
  return {
    netReceived,
    due: live ? Math.max(0, b.totalPrice - netReceived) : 0,
    overpaid: live ? Math.max(0, netReceived - b.totalPrice) : 0,
  };
}

export type ChargePaymentPlan =
  | { kind: "none" }
  | { kind: "error"; error: string }
  | { kind: "pay"; amount: number; body: { entryType: "payment"; amount: number; method: PaymentMethod; reason?: string; reference?: string; occurredAt?: string } };

/**
 * The payment recorded together with a charge ("Khách đã trả ngay"): the amount staff asked for, never above what is
 * still due AFTER the charge, validated by the same rules as any ledger payment. Nothing is recorded when nothing
 * was asked for or nothing is due.
 */
export function planChargePayment(collect: unknown, dueAfter: number, description: string, nowMs = Date.now()): ChargePaymentPlan {
  if (!collect || typeof collect !== "object") return { kind: "none" };
  const c = collect as { amount?: unknown; method?: unknown };
  const due = Math.max(0, Math.round(Number(dueAfter) || 0));
  const asked = Math.round(Number(c.amount));
  const amount = Number.isFinite(asked) && asked > 0 ? Math.min(asked, due) : 0;
  if (amount <= 0) return { kind: "none" };
  const plan = planLedgerAction({ action: "payment", amount, method: c.method, reason: `Thu phụ phí: ${description}` }, nowMs);
  if (!plan.ok) return { kind: "error", error: plan.error };
  if (plan.kind !== "entry" || plan.body.entryType !== "payment") return { kind: "error", error: "Thông tin thu tiền không hợp lệ." };
  return { kind: "pay", amount, body: { ...plan.body, entryType: "payment" } };
}

export type SettlePlan =
  | { kind: "none" }
  | { kind: "error"; error: string }
  | { kind: "payment" | "refund"; amount: number; body: { entryType: "payment" | "refund"; amount: number; method: PaymentMethod; reason?: string; reference?: string; occurredAt?: string } };

/**
 * The money recorded together with a price change ("Khách trả thêm ngay" / "Hoàn lại khách ngay"), judged against the
 * booking AFTER the change: a payment never exceeds what is still due, a refund never exceeds what the guest holds above
 * the new value (nor what was received). Nothing is recorded when nothing was asked for or nothing is left to settle.
 * Same validation as any ledger entry (a refund needs a reason).
 */
export function planSettlement(settle: unknown, after: { due: number; overpaid: number; netReceived: number }, description: string, nowMs = Date.now()): SettlePlan {
  if (!settle || typeof settle !== "object") return { kind: "none" };
  const s = settle as { kind?: unknown; amount?: unknown; method?: unknown };
  if (s.kind !== "payment" && s.kind !== "refund") return { kind: "none" };
  const cap = s.kind === "payment" ? Math.max(0, Math.round(after.due)) : Math.min(Math.max(0, Math.round(after.overpaid)), Math.max(0, Math.round(after.netReceived)));
  const asked = Math.round(Number(s.amount));
  const amount = Number.isFinite(asked) && asked > 0 ? Math.min(asked, cap) : 0;
  if (amount <= 0) return { kind: "none" };
  const plan = planLedgerAction({ action: s.kind, amount, method: s.method, reason: description }, nowMs);
  if (!plan.ok) return { kind: "error", error: plan.error };
  if (plan.kind !== "entry" || (plan.body.entryType !== "payment" && plan.body.entryType !== "refund")) return { kind: "error", error: "Thông tin thu/hoàn tiền không hợp lệ." };
  return { kind: s.kind, amount, body: { ...plan.body, entryType: plan.body.entryType } };
}

export type LedgerPlan =
  | { ok: true; kind: "entry"; body: { entryType: "payment" | "refund" | "adjustment"; amount: number; method: PaymentMethod; reason?: string; reference?: string; occurredAt?: string } }
  | { ok: true; kind: "reverse"; entryId: string; body: { reason: string } }
  | { ok: true; kind: "transfer"; body: { toBookingId: string; amount: number; reason: string; method: PaymentMethod } }
  | { ok: false; error: string; field?: string };

/**
 * Validates one ledger action from the drawer. `occurredAt` is a datetime-local value in VN time (when the money
 * moved); empty = now. Business limits (≤ due, ≤ net received, manager-only) are re-checked by Core.
 */
export function planLedgerAction(input: Record<string, unknown>, nowMs = Date.now()): LedgerPlan {
  const action = input.action;
  if (typeof action !== "string" || !(LEDGER_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: "Thao tác sổ thu tiền không hợp lệ.", field: "action" };
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";

  if (action === "reverse") {
    const entryId = typeof input.entryId === "string" ? input.entryId.trim() : "";
    if (!entryId) return { ok: false, error: "Thiếu bút toán cần đảo.", field: "entryId" };
    if (!reason) return { ok: false, error: "Vui lòng nhập lý do đảo bút toán.", field: "reason" };
    return { ok: true, kind: "reverse", entryId, body: { reason } };
  }

  if (action === "transfer") {
    const toBookingId = typeof input.toBookingId === "string" ? input.toBookingId.trim().toUpperCase() : "";
    const amt = Math.round(Number(input.amount));
    if (!/^EI-[A-Z0-9-]{4,40}$/.test(toBookingId)) return { ok: false, error: "Nhập mã đơn nhận tiền (VD: EI-20261110-E274).", field: "toBookingId" };
    if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "Vui lòng nhập số tiền lớn hơn 0.", field: "amount" };
    if (!reason) return { ok: false, error: "Vui lòng nhập lý do chuyển tiền.", field: "reason" };
    const m = typeof input.method === "string" && PAYMENT_METHODS.some((x) => x.value === input.method) ? (input.method as PaymentMethod) : "other";
    return { ok: true, kind: "transfer", body: { toBookingId, amount: amt, reason, method: m } };
  }

  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount === 0 || (action !== "adjustment" && amount < 0)) {
    return { ok: false, error: action === "adjustment" ? "Số tiền điều chỉnh phải khác 0 (âm = giảm)." : "Vui lòng nhập số tiền lớn hơn 0.", field: "amount" };
  }
  const methodIn = typeof input.method === "string" ? input.method : "";
  if (!PAYMENT_METHODS.some((m) => m.value === methodIn)) return { ok: false, error: "Vui lòng chọn phương thức thanh toán.", field: "method" };
  if ((action === "refund" || action === "adjustment") && !reason) {
    return { ok: false, error: action === "refund" ? "Vui lòng nhập lý do hoàn tiền." : "Điều chỉnh bắt buộc có lý do.", field: "reason" };
  }
  let occurredAt: string | undefined;
  const rawWhen = typeof input.occurredAt === "string" ? input.occurredAt.trim() : "";
  if (rawWhen) {
    const iso = /Z$|[+-]\d{2}:\d{2}$/.test(rawWhen) ? new Date(rawWhen).toISOString() : vnLocalInputToIso(rawWhen);
    if (!iso) return { ok: false, error: "Ngày giờ nhận / chi tiền không hợp lệ.", field: "occurredAt" };
    if (Date.parse(iso) > nowMs + 5 * 60_000) return { ok: false, error: "Ngày nhận / chi tiền không được ở tương lai.", field: "occurredAt" };
    occurredAt = iso;
  }
  const reference = typeof input.reference === "string" && input.reference.trim() ? input.reference.trim().slice(0, 120) : undefined;
  return {
    ok: true,
    kind: "entry",
    body: {
      entryType: action as "payment" | "refund" | "adjustment",
      amount,
      method: methodIn as PaymentMethod,
      ...(reason ? { reason } : {}),
      ...(reference ? { reference } : {}),
      ...(occurredAt ? { occurredAt } : {}),
    },
  };
}
