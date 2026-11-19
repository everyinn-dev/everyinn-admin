/**
 * View helpers for the revenue matrix (EI-FINANCE-ONTOLOGY-001 §6). Pure: Core computes every amount,
 * the page only sums cells it was given and derives display ratios.
 */
import type { RevenueBasis, RevenueCell, RevenueMatrix } from "@/types/finance";

export const BASIS_OPTIONS: readonly { value: RevenueBasis; label: string; hint: string }[] = [
  {
    value: "checkin",
    label: "Theo tháng check-in",
    hint: "Tiền phòng của đơn tính trọn vào tháng nhận phòng.",
  },
  {
    value: "night",
    label: "Chia theo đêm ở",
    hint: "Tiền phòng chia theo từng đêm khách ở; đơn kéo dài qua tháng sau thì chỉ tính phần đêm thuộc tháng đang xem.",
  },
];

export const emptyRevenueCell = (): RevenueCell => ({
  room: 0,
  charges: 0,
  retained: 0,
  restate: 0,
  total: 0,
  units: 0,
  occupiedDays: 0,
  bookings: 0,
  receivable: 0,
  overpaid: 0,
});

/** A cell from an older Core (values only) still renders: everything is "room". */
export function cellAt(data: RevenueMatrix, roomIndex: number, monthIndex: number): RevenueCell {
  const room = data.rooms[roomIndex];
  const c = room?.cells?.[monthIndex];
  if (c) return c;
  const v = room?.values[monthIndex] ?? 0;
  return { ...emptyRevenueCell(), room: v, total: v };
}

export function columnAt(data: RevenueMatrix, monthIndex: number): RevenueCell {
  const c = data.columns?.[monthIndex];
  if (c) return c;
  const v = data.columnTotals[monthIndex] ?? 0;
  const retained = data.retained?.columnTotals[monthIndex] ?? 0;
  return { ...emptyRevenueCell(), room: v, retained, total: v + retained };
}

export interface RevenueSummary extends RevenueCell {
  /** Average room revenue per night sold (ADR). */
  adr: number | null;
  /** Revenue per occupied room-day (ĐN2 "doanh thu trung bình ngày có khách"). */
  perOccupiedDay: number | null;
  /** Occupied room-days ÷ (rooms × days in the months). */
  occupancy: number | null;
}

export function summarize(data: RevenueMatrix): RevenueSummary {
  const g: RevenueCell = data.grand ?? data.months.reduce((acc, _m, i) => {
    const c = columnAt(data, i);
    for (const k of Object.keys(acc) as (keyof RevenueCell)[]) acc[k] += c[k];
    return acc;
  }, emptyRevenueCell());
  const days = (data.monthMeta ?? []).reduce((s, m) => s + m.daysInMonth, 0);
  const roomDays = days * data.rooms.length;
  return {
    ...g,
    adr: g.units > 0 ? Math.round(g.room / g.units) : null,
    perOccupiedDay: g.occupiedDays > 0 ? Math.round(g.total / g.occupiedDays) : null,
    occupancy: roomDays > 0 && g.occupiedDays > 0 ? g.occupiedDays / roomDays : null,
  };
}
