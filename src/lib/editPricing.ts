/**
 * Stay edit price choice (EI-FINANCE-ONTOLOGY-001 Q2) — the shape of Booking Core's
 * POST /internal/v1/bookings/{id}/modify-quote. Core computes every amount; the form only lets staff choose.
 */
export type PricingMode = "keep_agreed" | "current_rates";

export interface EditPriceOption {
  total: number;
  basePrice: number;
  holidaySurcharge: number;
  extraGuestFee: number;
  extraFee: number;
  promotionDiscount: number;
  loyaltyDiscount: number;
  promotionDropped: boolean;
  /** total − net received: > 0 still to collect, < 0 held over (to refund). */
  balance: number;
}

export interface EditQuote {
  bookingId: string;
  currentTotal: number;
  netReceived: number;
  pastCheckout: boolean;
  currentRates: EditPriceOption;
  /** null for a hand-typed (custom) price: the typed price is the deal. */
  keepAgreed: EditPriceOption | null;
  choiceRequired: boolean;
}

/**
 * What can be settled in the SAME step as a price change (edit of a stay, voiding a charge) — EI-FINANCE-ONTOLOGY-001 §8.
 *  - collect: the price went UP and something is due → "Khách trả thêm ngay" (default = the increase only, never the
 *    older balance; max = everything still due);
 *  - refund: the price went DOWN and the guest holds more than the new value → "Hoàn lại khách ngay" (default = the
 *    decrease, capped at what is held over; max = what is held over).
 * Pure, whole đồng.
 */
export interface SettleSlot {
  available: boolean;
  defaultAmount: number;
  max: number;
}
export interface EditSettlement {
  collect: SettleSlot;
  refund: SettleSlot;
}

const NONE: SettleSlot = { available: false, defaultAmount: 0, max: 0 };

export function editSettlement(currentTotal: number, newTotal: number, netReceived: number): EditSettlement {
  const cur = Math.round(currentTotal);
  const next = Math.round(newTotal);
  const net = Math.round(netReceived);
  const delta = next - cur;
  const due = Math.max(0, next - net);
  const over = Math.max(0, net - next);
  return {
    collect: delta > 0 && due > 0 ? { available: true, defaultAmount: Math.min(delta, due), max: due } : NONE,
    refund: delta < 0 && over > 0 ? { available: true, defaultAmount: Math.min(-delta, over), max: over } : NONE,
  };
}

/** What the staff member will have to do with the money after saving with `mode`. */
export function balanceHint(q: EditQuote, mode: PricingMode): { kind: "collect" | "refund" | "settled"; amount: number } {
  const opt = mode === "keep_agreed" && q.keepAgreed ? q.keepAgreed : q.currentRates;
  if (opt.balance > 0) return { kind: "collect", amount: opt.balance };
  if (opt.balance < 0) return { kind: "refund", amount: -opt.balance };
  return { kind: "settled", amount: 0 };
}
