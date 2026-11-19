import test from "node:test";
import assert from "node:assert/strict";
import { addDaysToDate, vnDateOf, vnDateTime, vnInstant, vnLocalInputToIso, vnLocalInputValue } from "../src/lib/vnTime.ts";

test("vnTime: instants are built in UTC+7 whatever the browser timezone (B8)", () => {
  assert.equal(vnInstant("2026-12-01", 14).toISOString(), "2026-12-01T07:00:00.000Z");
  assert.equal(vnInstant("2026-12-01", 34).toISOString(), "2026-12-02T03:00:00.000Z"); // overnight 22h + 12h
  assert.equal(vnInstant("2026-12-01", 12, 0, 2).toISOString(), "2026-12-03T05:00:00.000Z"); // day-use 2 nights → 12:00
  assert.equal(vnDateTime("2026-12-01", "05:30").toISOString(), "2026-11-30T22:30:00.000Z");
});

test("vnTime: VN date of an instant and calendar day arithmetic", () => {
  assert.equal(vnDateOf("2026-11-30T18:00:00Z"), "2026-12-01"); // 01:00 VN
  assert.equal(addDaysToDate("2026-12-01", -1), "2026-11-30"); // 'Trước 1 ngày' = exactly one day before
  assert.equal(addDaysToDate("2026-03-01", -1), "2026-02-28");
});

test("vnTime: datetime-local values round-trip in VN time", () => {
  assert.equal(vnLocalInputValue("2026-11-19T03:15:00Z"), "2026-11-19T10:15");
  assert.equal(vnLocalInputToIso("2026-11-19T10:15"), "2026-11-19T03:15:00.000Z");
  assert.equal(vnLocalInputToIso("bad"), null);
});
