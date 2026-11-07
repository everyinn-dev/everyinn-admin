import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

/**
 * Owner 2026-11-07: the booking form is the receptionist's screen — hours that have already passed today must stay
 * selectable (back-dated / walk-in bookings). Booking Core never blocked them; only this UI did.
 */
const src = readFileSync(new URL("../src/components/bookings/CustomFields.tsx", import.meta.url), "utf8");

test("the booking form time pickers do not disable past hours", () => {
  assert.ok(!/isPastTimeSlot/.test(src), "CustomFields must not use isPastTimeSlot");
  assert.ok(!/\(Đã qua\)/.test(src), "no '(Đã qua)' label on time options");
});

test("the logical rule stays: on the same day the check-out must be after the check-in", () => {
  assert.ok(/Trước giờ nhận/.test(src));
  assert.ok(/timeStrToMinutes\(slot\) <= timeStrToMinutes\(normalizedCheckinTime\)/.test(src));
});
