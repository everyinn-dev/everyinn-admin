export interface RevenueMatrixRoom {
  roomId: string;
  roomNumber: string;
  roomClass: string;
  floor: number;
  /** Revenue (VND) aligned with `RevenueMatrix.months`. */
  values: number[];
  total: number;
}

export interface RevenueMatrix {
  from: string;
  to: string;
  /** YYYY-MM, ascending. */
  months: string[];
  basis: "checkin_at";
  status: "confirmed";
  rooms: RevenueMatrixRoom[];
  columnTotals: number[];
  grandTotal: number;
  bookingCount: number;
  /** Money kept from cancelled / no-show bookings (received − refunded), by check-in month. Optional for older Cores. */
  retained?: {
    columnTotals: number[];
    grandTotal: number;
    bookingCount: number;
  };
}

