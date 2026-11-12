import test from "node:test";
import assert from "node:assert/strict";
import { activeCharges, availableChargeKinds, chargeNeedsReason, chargePresets, describeCharge, isTimeKind } from "../src/lib/charges.ts";
import { toLegacyBookingRow } from "../src/lib/coreMappers.ts";
import { bookingRowToItem } from "../src/lib/bookingClosure.ts";

test("which charge kinds each booking type offers (Core stays the authority)", () => {
  assert.deepEqual(availableChargeKinds("hourly"), ["extension", "incidental"]);
  assert.deepEqual(availableChargeKinds("overnight"), ["early_checkin", "late_checkout", "incidental"]);
  assert.deepEqual(availableChargeKinds("dayuse"), ["early_checkin", "late_checkout", "incidental"]);
  assert.deepEqual(availableChargeKinds("custom"), ["incidental"]); // hand-typed price: no per-hour charge
});

test("the quick buttons are presets of the one sheet: +1h for every non-custom type, always Phát sinh", () => {
  assert.deepEqual(chargePresets("hourly").map((p) => [p.label, p.kind, p.hours]), [["+1h Checkout", "extension", 1], ["Phát sinh", "incidental", 0]]);
  assert.deepEqual(chargePresets("overnight").map((p) => [p.label, p.kind]), [["Nhận sớm", "early_checkin"], ["+1h Checkout", "late_checkout"], ["Phát sinh", "incidental"]]);
  assert.deepEqual(chargePresets("custom").map((p) => p.kind), ["incidental"]);
  for (const t of ["hourly", "overnight", "dayuse", "custom"]) {
    for (const p of chargePresets(t)) assert.ok(availableChargeKinds(t).includes(p.kind), `${t}: ${p.label}`);
  }
});

test("charges stay open after checkout; only early check-in goes away once the check-in time has passed", () => {
  const NOW = Date.parse("2026-11-12T10:00:00.000Z");
  const started = { checkinAt: "2026-11-12T01:00:00.000Z", nowMs: NOW }; // already past check-in (and past checkout)
  const upcoming = { checkinAt: "2026-11-12T15:00:00.000Z", nowMs: NOW };
  assert.deepEqual(availableChargeKinds("overnight", started), ["late_checkout", "incidental"]);
  assert.deepEqual(availableChargeKinds("dayuse", upcoming), ["early_checkin", "late_checkout", "incidental"]);
  assert.deepEqual(availableChargeKinds("hourly", started), ["extension", "incidental"]);
  assert.deepEqual(availableChargeKinds("custom", started), ["incidental"]);
  assert.deepEqual(chargePresets("overnight", started).map((p) => p.kind), ["late_checkout", "incidental"]);
});

test("a fee different from the table (or any incidental charge) needs a reason", () => {
  assert.equal(chargeNeedsReason("incidental", 100_000, 100_000, false), true);
  assert.equal(chargeNeedsReason("extension", 60_000, 60_000, false), false);
  assert.equal(chargeNeedsReason("extension", 0, 60_000, true), true);
  assert.equal(chargeNeedsReason("late_checkout", 60_000, 60_000, true), false); // "agreed" but equal to the table
  assert.equal(isTimeKind("extension"), true);
  assert.equal(isTimeKind("incidental"), false);
});

test("charge lines are described and voided ones are not active", () => {
  assert.equal(describeCharge({ kind: "late_checkout", hours: 2, fee: 120_000 }), "Trả muộn 2h · 120.000đ");
  assert.equal(describeCharge({ kind: "incidental", hours: null, fee: 50_000 }), "Phát sinh · 50.000đ");
  const lines = [
    { id: "a", kind: "extension", hours: 1, fee: 60_000, tableFee: 60_000, voided: null },
    { id: "b", kind: "incidental", hours: null, fee: 50_000, tableFee: 50_000, voided: { at: "x", by: null, reason: "nhầm" } },
  ];
  assert.deepEqual(activeCharges(lines).map((l) => l.id), ["a"]);
  assert.deepEqual(activeCharges(undefined), []);
});

test("charges flow Core DTO → legacy row → drawer item", () => {
  const charges = [{ id: "chg_1", kind: "extension", hours: 1, fee: 60_000, tableFee: 60_000, reason: null, at: "2026-11-12T03:00:00.000Z", staffId: 1, staffName: "QL", voided: null, legacy: false }];
  const dto = {
    id: "bk-1", propertyId: "p", roomId: "haven-101", roomName: "101", roomClass: "haven", numGuests: 2, bookingType: "hourly",
    checkinAt: "2026-11-12T01:00:00.000Z", checkoutAt: "2026-11-12T05:00:00.000Z", earlyCheckinHours: 0, lateCheckoutHours: 1, status: "confirmed",
    note: null, closingNote: "ok",
    guest: { phoneDisplay: "0901234567", contactRaw: "0901234567", name: "A", instagram: null, facebook: null, zalo: null },
    pricing: { basePrice: 320_000, holidaySurcharge: 0, extraGuestFee: 0, extraFee: 60_000, discountAmount: 0, totalPrice: 380_000, originalPrice: null },
    promotion: null,
    loyalty: { syncStatus: "not_applicable", step: null, tier: null, syncedAt: null },
    financial: { isDeposit: false, depositAmount: 0, paidAmount: 0, refundAmount: 0, netPaid: 0, remainingAmount: 380_000, depositStatus: "none", depositDueDate: null, depositPaidAt: null, depositReminderSentAt: null, depositReminderSentBy: null, remainingPaidAt: null, remainingPaidBy: null },
    charges,
    lifecycle: { confirmedAt: null, cancelledAt: null, cancelledBy: null, cancelReason: null, closureReasonCode: null, noShowAt: null, noShowBy: null, noShowReason: null },
    control: { version: 3, createdAt: "2026-11-11T00:00:00.000Z", createdBy: null, updatedAt: "2026-11-12T03:00:00.000Z", updatedBy: null },
  };
  const row = toLegacyBookingRow(dto);
  assert.deepEqual(row.charges, charges);
  assert.deepEqual(bookingRowToItem(row).charges, charges);
  // older Core without the field: an empty list, never undefined
  const { charges: _omit, ...older } = dto;
  assert.deepEqual(toLegacyBookingRow(older).charges, []);
});
