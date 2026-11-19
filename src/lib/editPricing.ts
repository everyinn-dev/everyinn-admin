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

/** What the staff member will have to do with the money after saving with `mode`. */
export function balanceHint(q: EditQuote, mode: PricingMode): { kind: "collect" | "refund" | "settled"; amount: number } {
  const opt = mode === "keep_agreed" && q.keepAgreed ? q.keepAgreed : q.currentRates;
  if (opt.balance > 0) return { kind: "collect", amount: opt.balance };
  if (opt.balance < 0) return { kind: "refund", amount: -opt.balance };
  return { kind: "settled", amount: 0 };
}
