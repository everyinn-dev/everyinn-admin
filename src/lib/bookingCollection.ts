/**
 * Money collected when staff create a booking at the desk (EI-FINANCE-ONTOLOGY-001 §8, invariant 8).
 *
 * The ledger records only money that actually arrived. Staff state it explicitly:
 *  - "none"    → nothing received; the whole booking value is receivable.
 *  - "deposit" → a deposit of the amount typed in, plus the due date for the rest.
 *  - "full"    → the full booking value. The amount is Booking Core's final total of the created booking
 *                (after promotion AND loyalty) — never a client preview or the pre-loyalty quote.
 * An older client that sends no `collection` is treated as "none" (or "deposit" when it sends isDeposit) —
 * never as "paid in full".
 */
export const COLLECTION_MODES = ["none", "deposit", "full"] as const;
export type CollectionMode = (typeof COLLECTION_MODES)[number];

export const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "ewallet", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const COLLECTION_OPTIONS: readonly { value: CollectionMode; label: string; hint: string }[] = [
  { value: "none", label: "Chưa thu", hint: "Khách chưa trả đồng nào — toàn bộ giá trị đơn là còn phải thu." },
  { value: "deposit", label: "Đặt cọc", hint: "Khách cọc trước một phần, hẹn ngày thu phần còn lại." },
  { value: "full", label: "Đã thu đủ", hint: "Khách đã trả đủ — ghi đúng tổng cuối của đơn (sau ưu đãi & loyalty)." },
];

export interface CollectionPlan {
  mode: CollectionMode;
  method: PaymentMethod;
  deposit?: { amount: number; method: PaymentMethod; dueDate?: string };
}

export type CollectionResult = { ok: true; plan: CollectionPlan } | { ok: false; error: string };

export function planCollection(body: Record<string, unknown>): CollectionResult {
  const rawMode = body.collection;
  const legacyDeposit = Boolean(body.isDeposit ?? body.is_deposit);
  let mode: CollectionMode;
  if (rawMode === undefined || rawMode === null || rawMode === "") {
    mode = legacyDeposit ? "deposit" : "none";
  } else if (typeof rawMode === "string" && (COLLECTION_MODES as readonly string[]).includes(rawMode)) {
    mode = rawMode as CollectionMode;
  } else {
    return { ok: false, error: "Trạng thái thu tiền không hợp lệ." };
  }

  const rawMethod = body.paymentMethod ?? "cash";
  if (typeof rawMethod !== "string" || !(PAYMENT_METHODS as readonly string[]).includes(rawMethod)) {
    return { ok: false, error: "Phương thức thanh toán không hợp lệ." };
  }
  const method = rawMethod as PaymentMethod;

  if (mode !== "deposit") return { ok: true, plan: { mode, method } };

  const amount = Math.round(Number(body.depositAmount ?? body.deposit_amount) || 0);
  if (amount <= 0) return { ok: false, error: "Vui lòng nhập số tiền cọc hợp lệ." };
  const dueDate = String(body.depositDueDate ?? body.deposit_due_date ?? "").trim() || undefined;
  return { ok: true, plan: { mode, method, deposit: { amount, method, ...(dueDate ? { dueDate } : {}) } } };
}

/** Idempotency key of the "paid in full" ledger entry, derived from the booking-create key (retry-safe). */
export function fullPaymentKey(createKey: string): string {
  return `${createKey.slice(0, 120)}.full`;
}
