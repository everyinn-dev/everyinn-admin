/**
 * Stay charges (Booking Core `/bookings/:id/charges`): one command for "+N hours", early check-in, late check-out and
 * incidental charges. The buttons in the drawer are only presets of the same sheet — this module is their single source.
 */
import type { BookingType } from "@/types";

export type ChargeKind = "early_checkin" | "late_checkout" | "extension" | "incidental";

export interface ChargeLine {
  id: string;
  kind: ChargeKind;
  hours: number | null;
  fee: number;
  tableFee: number;
  reason: string | null;
  at: string;
  staffId: number | null;
  staffName: string | null;
  voided: { at: string; by: string | null; reason: string } | null;
  legacy: boolean;
}

export interface ChargeQuote {
  bookingId: string;
  version: number;
  kind: ChargeKind;
  hours: number | null;
  tableFee: number;
  fee: number;
  checkinAt: string;
  checkoutAt: string;
  newCheckinAt: string;
  newCheckoutAt: string;
  available: boolean;
  conflict: { code: string; message: string } | null;
  maxHours: number;
  earliestCheckinAt: string | null;
  latestCheckoutAt: string | null;
  totalBefore: number;
  totalAfter: number;
  netPaid: number;
  remainingBefore: number;
  remainingAfter: number;
}

export const CHARGE_KIND_LABEL: Record<ChargeKind, string> = {
  extension: "Thêm giờ",
  late_checkout: "Trả muộn",
  early_checkin: "Nhận sớm",
  incidental: "Phát sinh",
};

export const CHARGE_KIND_ICON: Record<ChargeKind, string> = {
  extension: "⏱️",
  late_checkout: "🌙",
  early_checkin: "🌅",
  incidental: "🧾",
};

export interface ChargeTiming {
  checkinAt: string;
  /** injectable for tests */
  nowMs?: number;
}

/**
 * Which kinds the business rules allow for a booking type (Core is the authority; this only hides impossible buttons).
 * Charges stay open AFTER checkout (a broken glass found in the room, a guest who left late): only "nhận sớm" goes away
 * once the check-in time has passed, because there is nothing left to be early for.
 */
export function availableChargeKinds(bookingType: BookingType, timing?: ChargeTiming): ChargeKind[] {
  const started = timing ? (timing.nowMs ?? Date.now()) >= Date.parse(timing.checkinAt) : false;
  switch (bookingType) {
    case "hourly":
      return ["extension", "incidental"];
    case "overnight":
    case "dayuse":
      return started ? ["late_checkout", "incidental"] : ["early_checkin", "late_checkout", "incidental"];
    default:
      return ["incidental"]; // custom: hand-typed price, no per-hour charge
  }
}

export interface ChargePreset {
  id: string;
  label: string;
  kind: ChargeKind;
  hours: number;
}

/** The quick buttons. Each one just opens the sheet with a kind (and hours) already chosen. */
export function chargePresets(bookingType: BookingType, timing?: ChargeTiming): ChargePreset[] {
  const kinds = availableChargeKinds(bookingType, timing);
  const out: ChargePreset[] = [];
  if (kinds.includes("extension")) out.push({ id: "plus1h", label: "+1h Checkout", kind: "extension", hours: 1 });
  if (kinds.includes("early_checkin")) out.push({ id: "early", label: "Nhận sớm", kind: "early_checkin", hours: 1 });
  if (kinds.includes("late_checkout")) out.push({ id: "plus1h", label: "+1h Checkout", kind: "late_checkout", hours: 1 });
  out.push({ id: "incidental", label: "Phát sinh", kind: "incidental", hours: 0 });
  return out;
}

export const isTimeKind = (kind: ChargeKind): boolean => kind !== "incidental";

/** The charge line as one sentence: "Trả muộn 2h · 120.000đ". */
export function describeCharge(line: Pick<ChargeLine, "kind" | "hours" | "fee">): string {
  const money = `${Math.round(line.fee).toLocaleString("vi-VN")}đ`;
  return line.hours ? `${CHARGE_KIND_LABEL[line.kind]} ${line.hours}h · ${money}` : `${CHARGE_KIND_LABEL[line.kind]} · ${money}`;
}

/** Lines still counted in the total (a voided incidental line stays in the list for the record). */
export const activeCharges = (lines: readonly ChargeLine[] | undefined): ChargeLine[] => (lines ?? []).filter((l) => !l.voided);

/** A fee that differs from the rate table is an agreed price: the reason is mandatory (Core 400 REASON_REQUIRED). */
export function chargeNeedsReason(kind: ChargeKind, fee: number, tableFee: number, overridden: boolean): boolean {
  return kind === "incidental" || (overridden && fee !== tableFee);
}
