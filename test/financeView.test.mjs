import test from "node:test";
import assert from "node:assert/strict";
import { BASIS_OPTIONS, cellAt, columnAt, summarize } from "../src/lib/financeView.ts";

const cell = (o = {}) => ({ room: 0, charges: 0, retained: 0, restate: 0, total: 0, units: 0, occupiedDays: 0, bookings: 0, receivable: 0, overpaid: 0, ...o });

const matrix = {
  from: "2042-01",
  to: "2042-02",
  months: ["2042-01", "2042-02"],
  basis: "night",
  status: "confirmed",
  monthMeta: [
    { month: "2042-01", locked: true, daysInMonth: 31 },
    { month: "2042-02", locked: false, daysInMonth: 28 },
  ],
  rooms: [
    { roomId: "haven-101", roomNumber: "101", roomClass: "haven", floor: 1, values: [900000, 530000], total: 1430000,
      cells: [cell({ room: 900000, total: 900000, units: 2, occupiedDays: 2 }), cell({ room: 450000, charges: 80000, total: 530000, units: 1, occupiedDays: 1, receivable: 100000 })] },
    { roomId: "sig-102", roomNumber: "102", roomClass: "signature", floor: 1, values: [0, -50000], total: -50000,
      cells: [cell(), cell({ retained: 40000, restate: -90000, total: -50000 })] },
  ],
  columnTotals: [900000, 480000],
  columns: [cell({ room: 900000, total: 900000, units: 2, occupiedDays: 2 }), cell({ room: 450000, charges: 80000, retained: 40000, restate: -90000, total: 480000, units: 1, occupiedDays: 1, receivable: 100000 })],
  grandTotal: 1380000,
  grand: cell({ room: 1350000, charges: 80000, retained: 40000, restate: -90000, total: 1380000, units: 3, occupiedDays: 3, receivable: 100000 }),
  bookingCount: 1,
};

test("finance view: both ontology bases are offered, ĐN1 first", () => {
  assert.deepEqual(BASIS_OPTIONS.map((o) => o.value), ["checkin", "night"]);
});

test("finance view: summary derives ADR, revenue per occupied room-day and occupancy from Core's cells", () => {
  const s = summarize(matrix);
  assert.equal(s.total, 1380000);
  assert.equal(s.adr, 450000); // 1.350k room ÷ 3 nights
  assert.equal(s.perOccupiedDay, 460000); // 1.380k ÷ 3 room-days
  assert.equal(s.occupancy, 3 / ((31 + 28) * 2));
  assert.equal(s.receivable, 100000);
});

test("finance view: cells from an older Core (values only) still render as room revenue", () => {
  const old = { ...matrix, rooms: matrix.rooms.map(({ cells, ...r }) => r), columns: undefined, grand: undefined, monthMeta: undefined, retained: { columnTotals: [0, 40000], grandTotal: 40000, bookingCount: 1 } };
  assert.deepEqual(cellAt(old, 0, 1), cell({ room: 530000, total: 530000 }));
  assert.deepEqual(columnAt(old, 1), cell({ room: 480000, retained: 40000, total: 520000 }));
  const s = summarize(old);
  assert.equal(s.adr, null);
  assert.equal(s.occupancy, null);
});
