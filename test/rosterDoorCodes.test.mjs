import test from "node:test";
import assert from "node:assert/strict";
import { applyDoorCodes } from "../src/lib/rosterDoorCodes.ts";

test("roster door codes are filled from agent-core and the missing count is recomputed (BUG-14)", () => {
  const roster = {
    date: "2026-11-03",
    summary: { totalCheckins: 2, totalCheckouts: 0, hourlyCount: 0, overnightCount: 2, dayuseCount: 0, customCount: 0, doorCodeMissingCount: 2 },
    checkins: [{ id: "EI-1", roomId: "haven-101" }, { id: "EI-2", roomId: "sig-302" }],
    checkouts: [],
  };
  const out = applyDoorCodes(roster, [
    { bookingId: "EI-1", resolved: { missing: [] }, gateCode: "2580#", lockboxCode: "1234" },
    { bookingId: "EI-2", resolved: { missing: ["lockbox"] }, gateCode: "2580#", lockboxCode: null },
  ]);
  assert.equal(out.checkins[0].doorCode, "Cổng 2580# · Hộp khóa 1234");
  assert.equal(out.checkins[1].doorCode, undefined);
  assert.equal(out.summary.doorCodeMissingCount, 1);
});
