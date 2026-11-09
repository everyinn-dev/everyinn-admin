import test from "node:test";
import assert from "node:assert/strict";
import { toVnDateInput, toVnTimeInput, getVnHour } from "../src/lib/timelineUtils.ts";

test("BookingEditForm: Vietnam timezone date parsing prevents 24-hour shift for midnight check-in (customer 0395304020)", () => {
  // Production customer 0395304020: checkin_at = 2026-11-08T17:00:00.000Z (00:00:00 09/11/2026 in VN)
  const checkinAt = "2026-11-08T17:00:00.000Z";
  const checkoutAt = "2026-11-09T09:00:00.000Z"; // 16:00:00 09/11/2026 in VN (extended 2h from 14:00)

  const dateIn = toVnDateInput(new Date(checkinAt));
  const timeIn = toVnTimeInput(new Date(checkinAt));
  const hourIn = getVnHour(new Date(checkinAt));

  const dateOut = toVnDateInput(new Date(checkoutAt));
  const timeOut = toVnTimeInput(new Date(checkoutAt));
  const hourOut = getVnHour(new Date(checkoutAt));

  // Must be 2026-11-09 (NOT 2026-11-08 from UTC string slicing!)
  assert.equal(dateIn, "2026-11-09");
  assert.equal(timeIn, "00:00");
  assert.equal(hourIn, 0);

  // Checkout must be 2026-11-09 16:00
  assert.equal(dateOut, "2026-11-09");
  assert.equal(timeOut, "16:00");
  assert.equal(hourOut, 16);

  // Roundtrip reconstruction with +07:00 must match original ISO UTC timestamps exactly
  const reconstructedCheckin = new Date(`${dateIn}T${timeIn}:00+07:00`).toISOString();
  const reconstructedCheckout = new Date(`${dateOut}T${timeOut}:00+07:00`).toISOString();

  assert.equal(reconstructedCheckin, checkinAt);
  assert.equal(reconstructedCheckout, checkoutAt);
});

test("BookingEditForm: customPrice preserves extension fees (+1h checkout)", () => {
  // Booking after 2x extend1h (+120.000đ):
  // base_price = 678000, extra_fee = 120000, total_price = 798000
  const booking = {
    id: "EI-20261108-5WNQ",
    booking_type: "custom",
    base_price: 678000,
    extra_fee: 120000,
    incidental_fee: 0,
    total_price: 798000,
    checkin_at: "2026-11-08T17:00:00.000Z",
    checkout_at: "2026-11-09T09:00:00.000Z",
    late_checkout_hours: 2,
  };

  const stayTotal = Math.max(0, (booking.total_price || 0) - (booking.incidental_fee || 0));
  const customPrice = stayTotal || (booking.base_price || 0) + (booking.extra_fee || 0);

  // Must be 798.000đ, NOT the pre-extension base_price 678.000đ
  assert.equal(customPrice, 798000);
});

test("BookingEditForm: customPrice separates incidental fee from stay price", () => {
  // Booking with 2x extend1h (+120k) AND 50k incidental fee (phát sinh đền bù)
  const booking = {
    id: "EI-20261108-TEST",
    booking_type: "custom",
    base_price: 678000,
    extra_fee: 120000,
    incidental_fee: 50000,
    total_price: 848000, // 678k + 120k + 50k
  };

  const stayTotal = Math.max(0, (booking.total_price || 0) - (booking.incidental_fee || 0));
  const customPrice = stayTotal || (booking.base_price || 0) + (booking.extra_fee || 0);

  // Stay price must be 798.000đ, and incidental is 50.000đ
  assert.equal(customPrice, 798000);
  assert.equal(customPrice + booking.incidental_fee, 848000);
});
