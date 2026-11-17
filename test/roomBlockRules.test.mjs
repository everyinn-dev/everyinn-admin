import test from "node:test";
import assert from "node:assert/strict";
import { activeBlockNow, addDaysStr, blockPhase, canManageBlockType, roomBlockTypeOf, vnLocalToIso, vnNextSlot } from "../src/lib/roomBlocks.ts";

test("role by block type mirrors Booking Core: stop_sell / owner_stay are manager-only", () => {
  assert.equal(canManageBlockType("maintenance", false), true);
  assert.equal(canManageBlockType("deep_cleaning", false), true);
  assert.equal(canManageBlockType("stop_sell", false), false);
  assert.equal(canManageBlockType("owner_stay", false), false);
  assert.equal(canManageBlockType("stop_sell", true), true);
  assert.equal(canManageBlockType(undefined, false), true); // legacy rows default to maintenance
  assert.equal(roomBlockTypeOf("unknown").code, "maintenance");
});

test("Vietnam wall clock is independent of the device timezone", () => {
  assert.equal(vnLocalToIso("2026-11-17", "23:00"), "2026-11-17T16:00:00.000Z");
  // 10:05 UTC = 17:05 VN → next slot 17:30 same VN day
  assert.deepEqual(vnNextSlot(Date.parse("2026-11-17T10:05:00Z")), { date: "2026-11-17", time: "17:30" });
  // 16:50 UTC = 23:50 VN → next slot rolls to tomorrow 00:00 VN (never a past slot of "today")
  assert.deepEqual(vnNextSlot(Date.parse("2026-11-17T16:50:00Z")), { date: "2026-11-18", time: "00:00" });
  assert.deepEqual(vnNextSlot(Date.parse("2026-11-17T10:30:00Z")), { date: "2026-11-17", time: "17:30" });
  assert.equal(addDaysStr("2026-12-31", 1), "2027-01-01");
});

test("block phase drives the badge and the mobile card", () => {
  const b = { blockedFrom: "2026-11-17T10:00:00.000Z", blockedTo: "2026-11-17T12:00:00.000Z" };
  assert.equal(blockPhase(b, Date.parse("2026-11-17T09:59:00Z")), "upcoming");
  assert.equal(blockPhase(b, Date.parse("2026-11-17T11:00:00Z")), "active");
  assert.equal(blockPhase(b, Date.parse("2026-11-17T12:00:00Z")), "ended");
  assert.equal(activeBlockNow([b], Date.parse("2026-11-17T11:00:00Z")), b);
  assert.equal(activeBlockNow([b], Date.parse("2026-11-17T13:00:00Z")), undefined);
});
