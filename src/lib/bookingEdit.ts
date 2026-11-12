/**
 * Pure rules of the booking edit form (kept out of the .tsx so they are unit-testable).
 * See ADMIN_BOOKING_EDIT_REVIEW_2026-11-12: the booking type is locked, money changes need a reason.
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
  originalIncidentalFee: number;
  originalIncidentalReason: string;
  showIncidental: boolean;
  incidentalFee: number;
  incidentalReason: string;
}

export interface MoneyEditState {
  activeIncidental: number;
  customPriceChanged: boolean;
  incidentalChanged: boolean;
  /** Core answers 400 REASON_REQUIRED without a reason in these cases. */
  needsReason: boolean;
}

export function moneyEditState(i: MoneyEditInput): MoneyEditState {
  const activeIncidental = i.showIncidental ? Math.max(0, Number(i.incidentalFee) || 0) : 0;
  const customPriceChanged = i.originalType === "custom" && i.customPrice !== i.originalCustomPrice;
  const incidentalChanged =
    activeIncidental !== i.originalIncidentalFee ||
    (activeIncidental > 0 && (i.incidentalReason || "").trim() !== (i.originalIncidentalReason || "").trim());
  return { activeIncidental, customPriceChanged, incidentalChanged, needsReason: customPriceChanged || incidentalChanged };
}

/** A reason is satisfied by the dedicated field, or (for a charge being set) by the charge's own description. */
export function hasMoneyReason(state: MoneyEditState, moneyReason: string, incidentalReason: string): boolean {
  if (!state.needsReason) return true;
  if (moneyReason.trim()) return true;
  return state.incidentalChanged && state.activeIncidental > 0 && incidentalReason.trim().length > 0;
}
