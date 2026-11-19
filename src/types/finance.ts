/**
 * Revenue matrix from Booking Core — EI-FINANCE-ONTOLOGY-001.
 *  - basis "checkin" (ĐN1): room revenue in the month of check-in.
 *  - basis "night"   (ĐN2): room revenue split over the nights of the stay.
 * Both add stay charges on the day recorded and money retained from cancelled / no-show bookings on the closure day.
 */
export type RevenueBasis = "checkin" | "night";

export interface RevenueCell {
  /** Room net (after promotion & loyalty). */
  room: number;
  /** Stay charges (incidental, +hours, early / late) by the day recorded; voids negative on the void day. */
  charges: number;
  /** Money kept from cancelled / no-show bookings, on the closure day (later refunds on their day). */
  retained: number;
  /** Drift of locked months, booked into the first open month. */
  restate: number;
  /** room + charges + retained + restate */
  total: number;
  /** Nights / day-uses sold. */
  units: number;
  occupiedDays: number;
  bookings: number;
  /** Reconciliation, NOT revenue: still due on live bookings (by check-in month). */
  receivable: number;
  /** Reconciliation, NOT revenue: money held above the booking value. */
  overpaid: number;
}

export interface RevenueMatrixRoom {
  roomId: string;
  roomNumber: string;
  roomClass: string;
  floor: number;
  /** Cell totals (VND) aligned with `RevenueMatrix.months`. */
  values: number[];
  total: number;
  /** Optional for older Cores. */
  cells?: RevenueCell[];
  totals?: RevenueCell;
}

export interface RevenueMonthMeta {
  month: string;
  /** Frozen after the 5th of the next month. */
  locked: boolean;
  daysInMonth: number;
}

export interface RevenueMatrix {
  from: string;
  to: string;
  /** YYYY-MM, ascending. */
  months: string[];
  basis: RevenueBasis | "checkin_at";
  status: "confirmed";
  monthMeta?: RevenueMonthMeta[];
  rooms: RevenueMatrixRoom[];
  columnTotals: number[];
  columns?: RevenueCell[];
  grandTotal: number;
  grand?: RevenueCell;
  bookingCount: number;
  retained?: {
    columnTotals: number[];
    grandTotal: number;
    bookingCount: number;
  };
}
