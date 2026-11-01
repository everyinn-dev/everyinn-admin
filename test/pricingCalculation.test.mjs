import test from "node:test";
import assert from "node:assert/strict";
import { calculatePrice, matchesBookingType } from "../src/lib/pricing.ts";
import { evaluatePromotion } from "../src/lib/promotions.ts";

const samplePricingRules = [
  {
    id: 1,
    room_class: "haven",
    booking_type: "combo3h",
    base_duration_hours: 3,
    base_price: 350000,
    extra_hour_fee: 50000,
    is_active: 1,
  },
  {
    id: 2,
    room_class: "haven",
    booking_type: "overnight",
    base_price: 600000,
    extra_hour_fee: 50000,
    is_active: 1,
  },
  {
    id: 3,
    room_class: "haven",
    booking_type: "dayroom",
    base_price: 850000,
    extra_hour_fee: 50000,
    is_active: 1,
  },
];

test("matchesBookingType correctly bridges catalog rate plan codes to form booking types", () => {
  assert.equal(matchesBookingType("combo3h", "hourly"), true);
  assert.equal(matchesBookingType("combo6h", "hourly"), true);
  assert.equal(matchesBookingType("hourly", "hourly"), true);
  assert.equal(matchesBookingType("dayroom", "dayuse"), true);
  assert.equal(matchesBookingType("dayuse", "dayuse"), true);
  assert.equal(matchesBookingType("overnight", "overnight"), true);

  assert.equal(matchesBookingType("combo3h", "overnight"), false);
  assert.equal(matchesBookingType("dayroom", "hourly"), false);
});

test("calculatePrice succeeds for hourly booking with combo3h rule", () => {
  const checkin = new Date("2026-11-05T14:00:00");
  const checkout = new Date("2026-11-05T17:00:00");

  const pricing = calculatePrice({
    bookingType: "hourly",
    roomClass: "haven",
    checkinAt: checkin,
    checkoutAt: checkout,
    pricingRules: samplePricingRules,
    surchargeRules: [],
  });

  assert.equal(pricing.basePrice, 350000);
  assert.equal(pricing.extraHours, 0);
  assert.equal(pricing.totalPrice, 350000);
});

test("calculatePrice succeeds for dayuse booking with dayroom rule", () => {
  const checkin = new Date("2026-11-05T15:00:00");
  const checkout = new Date("2026-11-06T12:00:00");

  const pricing = calculatePrice({
    bookingType: "dayuse",
    roomClass: "haven",
    checkinAt: checkin,
    checkoutAt: checkout,
    pricingRules: samplePricingRules,
    surchargeRules: [],
  });

  assert.equal(pricing.basePrice, 850000);
  assert.equal(pricing.nightsCount, 1);
  assert.equal(pricing.totalPrice, 850000);
});

test("evaluatePromotion applies to hourly booking when applicable_booking_types is empty or includes hourly", () => {
  const checkin = new Date("2026-11-05T14:00:00");
  const checkout = new Date("2026-11-05T17:00:00");

  const promoGlobal = {
    id: "PROMO-FALL",
    name: "Mùa Thu Vàng",
    code: "THUVANG",
    discount_type: "percentage",
    discount_value: 10,
    min_order_amount: 0,
    applicable_room_classes: [],
    applicable_booking_types: [],
    applicable_loyalty_tiers: [],
    applicable_days_of_week: [0, 1, 2, 3, 4, 5, 6],
    is_active: 1,
    used_count: 0,
  };

  const evalGlobal = evaluatePromotion(promoGlobal, {
    roomClass: "haven",
    bookingType: "hourly",
    checkinAt: checkin,
    checkoutAt: checkout,
    basePrice: 350000,
    rawSubtotal: 350000,
    memberTier: "new",
  });

  assert.equal(evalGlobal.eligible, true);
  assert.equal(evalGlobal.discountAmount, 35000);

  const promoHourlySpecific = {
    ...promoGlobal,
    id: "PROMO-HOURLY-ONLY",
    applicable_booking_types: ["hourly"],
  };

  const evalHourly = evaluatePromotion(promoHourlySpecific, {
    roomClass: "haven",
    bookingType: "hourly",
    checkinAt: checkin,
    checkoutAt: checkout,
    basePrice: 350000,
    rawSubtotal: 350000,
    memberTier: "new",
  });

  assert.equal(evalHourly.eligible, true);

  const promoOvernightOnly = {
    ...promoGlobal,
    id: "PROMO-OVERNIGHT-ONLY",
    applicable_booking_types: ["overnight"],
  };

  const evalOvernightMismatch = evaluatePromotion(promoOvernightOnly, {
    roomClass: "haven",
    bookingType: "hourly",
    checkinAt: checkin,
    checkoutAt: checkout,
    basePrice: 350000,
    rawSubtotal: 350000,
    memberTier: "new",
  });

  assert.equal(evalOvernightMismatch.eligible, false);
  assert.match(evalOvernightMismatch.reason, /Chỉ áp dụng cho hình thức/);
});

