/**
 * LSB-6 — Admin calendar: the matrix the page renders conforms to the synced Booking Core contract, the scope
 * helper only forwards known fields, and writes reach Booking Core with the manager actor.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bookingCore, setTestFetcher } from "../src/lib/cores.ts";
import { overrideScope } from "../src/lib/calendar.ts";
import { addDays, daysBetween, vnInstant, weekdayOf } from "../src/components/calendar/types.ts";
import { createValidator } from "./helpers/schemaValidator.mjs";
import { FakeCore } from "./helpers/fakeCore.mjs";

const doc = JSON.parse(readFileSync(new URL("../contracts/booking-core.openapi.json", import.meta.url), "utf8"));
const v = createValidator(doc);
const manager = { id: 1, role: "manager", full_name: "Quản Lý" };

const day = (date, extra = {}) => ({
  date,
  bookable: true,
  rates: {
    combo3h: { price: 320000, listPrice: 320000, override: null },
    overnight: { price: 450000, listPrice: 520000, override: { id: "rov_1", scope: "class", note: "Mùa thấp điểm" } },
    dayroom: { price: 690000, listPrice: 690000, override: null },
  },
  closures: [],
  bookings: 0,
  holds: 0,
  occupancyPct: 0,
  ...extra,
});

test("a calendar matrix sample conforms to the Booking Core contract (CalendarMatrix)", () => {
  const matrix = {
    from: "2026-12-01",
    to: "2026-12-02",
    today: "2026-11-08",
    bookingWindow: { maxAdvanceDays: 90, maxDate: "2027-02-06" },
    ratePlans: ["combo3h", "overnight", "dayroom"],
    blockTypes: [{ code: "stop_sell", label: "Đóng bán" }],
    rooms: [
      {
        id: "sig-202",
        name: "Signature 202",
        roomNumber: "202",
        roomClass: "signature",
        days: [day("2026-12-01"), day("2026-12-02", { closures: [{ id: "blk_1", blockType: "stop_sell", reason: "Đóng bán", from: "2026-12-02T05:00:00.000Z", to: "2026-12-03T05:00:00.000Z", version: 1 }], bookings: 1, holds: 1, occupancyPct: 42 })],
      },
    ],
  };
  assert.deepEqual(v.validateSchema("#/components/schemas/CalendarMatrix", matrix), []);
  assert.notDeepEqual(v.validateSchema("#/components/schemas/CalendarMatrix", { ...matrix, rooms: [{ ...matrix.rooms[0], days: [day("2026-12-01", { occupancyPct: 140 })] }] }), []);
});

test("overrideScope forwards only the calendar scope (null room = whole class, weekdays only when set)", () => {
  assert.deepEqual(overrideScope({ roomClass: "haven", roomId: "", ratePlanCodes: ["overnight"], fromDate: "2026-12-01", toDate: "2026-12-07", weekdays: [], customBasePrice: 1, evil: true }), {
    roomClass: "haven",
    roomId: null,
    ratePlanCodes: ["overnight"],
    fromDate: "2026-12-01",
    toDate: "2026-12-07",
  });
  assert.deepEqual(overrideScope({ roomClass: "signature", roomId: "sig-202", ratePlanCodes: ["dayroom"], fromDate: "a", toDate: "b", weekdays: [5, 6] }).weekdays, [5, 6]);
});

test("calendar date helpers: VN instants, ranges across months, weekdays", () => {
  assert.equal(vnInstant("2026-12-01", "12:00"), "2026-12-01T05:00:00.000Z");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(daysBetween("2026-12-01", "2026-12-31"), 31);
  assert.equal(weekdayOf("2026-11-08"), 0);
});

test("bulk stop-sell and price writes reach Booking Core with the manager actor and an idempotency key", async () => {
  const fake = new FakeCore("booking");
  fake.on("POST", "/internal/v1/room-blocks/bulk", (req) => {
    assert.ok(req.headers["idempotency-key"]);
    assert.equal(req.headers["x-ei-actor-role"], "manager");
    assert.equal(req.body.skipConflicts, true);
    return { status: 201, body: { blocks: [], skipped: [{ roomId: "haven-101", roomName: "Haven 101", message: "Đang có khách" }], batchId: "bbk_1", replayed: false } };
  });
  fake.on("PUT", "/internal/v1/rate-overrides", (req) => {
    assert.equal(req.body.customBasePrice, 450000);
    return { status: 200, body: { updated: 7 } };
  });
  setTestFetcher(() => fake);
  try {
    const bulk = await bookingCore.post("/internal/v1/room-blocks/bulk", { staff: manager, idempotencyKey: "bulk-test-0001", body: { roomIds: ["*"], blockType: "stop_sell", blockedFrom: "2026-12-01T05:00:00.000Z", blockedTo: "2026-12-02T05:00:00.000Z", skipConflicts: true } });
    assert.equal(bulk.data.skipped[0].roomId, "haven-101");
    assert.deepEqual(v.validateSchema("#/components/schemas/BulkBlocksResult", bulk.data), []);
    const put = await bookingCore.put("/internal/v1/rate-overrides", { staff: manager, body: { ...overrideScope({ roomClass: "haven", ratePlanCodes: ["overnight"], fromDate: "2026-12-01", toDate: "2026-12-07" }), customBasePrice: 450000 } });
    assert.equal(put.data.updated, 7);
  } finally {
    setTestFetcher(null);
  }
});
