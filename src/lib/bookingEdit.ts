/**
 * Pure rules of the booking edit form (kept out of the .tsx so they are unit-testable).
 * See ADMIN_BOOKING_EDIT_REVIEW_2026-11-12: the booking type is locked, a changed price needs a reason, and every
 * extra charge (+1h, early, late, incidental) goes through the charge sheet — not through this form.
 */
import type { BookingType } from "@/types";

/**
 * Starting value of the custom-price field. It must be the booking's BASE price (what the receptionist typed at
 * creation), never `totalPrice`: the total is after the promotion and includes extension fees, and Core would take
 * it as the new base and apply the promotion again on every save.
 */
export function initialCustomPrice(b: { base_price?: number; basePrice?: number; total_price?: number; totalPrice?: number; incidental_fee?: number; incidentalFee?: number }): number {
  const base = b.base_price ?? b.basePrice;
  if (typeof base === "number" && base > 0) return base;
  const total = b.total_price ?? b.totalPrice ?? 0;
  const incidental = b.incidental_fee ?? b.incidentalFee ?? 0;
  return Math.max(0, total - incidental);
}

export interface MoneyEditInput {
  /** The type the booking was created with (never the one currently selected: it cannot change). */
  originalType: BookingType;
  originalCustomPrice: number;
  customPrice: number;
}

export interface MoneyEditState {
  customPriceChanged: boolean;
  /** Core answers 400 REASON_REQUIRED without a reason in this case. */
  needsReason: boolean;
}

export function moneyEditState(i: MoneyEditInput): MoneyEditState {
  const customPriceChanged = i.originalType === "custom" && i.customPrice !== i.originalCustomPrice;
  return { customPriceChanged, needsReason: customPriceChanged };
}

export function hasMoneyReason(state: MoneyEditState, moneyReason: string): boolean {
  return !state.needsReason || moneyReason.trim().length > 0;
}
