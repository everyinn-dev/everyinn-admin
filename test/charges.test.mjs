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

test("collect on the charge sheet: only when there is something to collect; default = this charge, capped at what is due", async () => {
  const { collectPlan, clampCollect } = await import("../src/lib/charges.ts");
  assert.deepEqual(collectPlan(60_000, 60_000), { available: true, defaultAmount: 60_000, max: 60_000 });
  assert.equal(collectPlan(0, 60_000).available, false); // a free hour: nothing to collect
  assert.equal(collectPlan(60_000, 0).available, false); // nothing due after the charge (already overpaid / settled)
  // deposit booking that still owes an older balance: default is THIS charge only, max is the whole balance
  assert.deepEqual(collectPlan(60_000, 360_000), { available: true, defaultAmount: 60_000, max: 360_000 });
  // fee larger than what is due (cannot collect above the due amount)
  assert.deepEqual(collectPlan(100_000, 40_000), { available: true, defaultAmount: 40_000, max: 40_000 });
  assert.deepEqual(collectPlan(59_999.6, 100_000), { available: true, defaultAmount: 60_000, max: 100_000 });
});

test("collect: the recorded amount is clamped to what is due and never negative or fractional", async () => {
  const { clampCollect } = await import("../src/lib/charges.ts");
  assert.equal(clampCollect(60_000, 60_000), 60_000);
  assert.equal(clampCollect(90_000, 60_000), 60_000);
  assert.equal(clampCollect(20_000.4, 60_000), 20_000);
  assert.equal(clampCollect(0, 60_000), 0);
  assert.equal(clampCollect(-5, 60_000), 0);
  assert.equal(clampCollect(Number.NaN, 60_000), 0);
});

test("derived idempotency key: stable, distinct from the intent's key, within Core's 8–128 chars", async () => {
  const { derivedKey } = await import("../src/lib/derivedKey.ts");
  assert.equal(derivedKey("adm.charge.abc12345", "pay"), "adm.charge.abc12345.pay");
  assert.equal(derivedKey("adm.charge.abc12345", "pay"), derivedKey("adm.charge.abc12345", "pay"));
  const long = derivedKey("k".repeat(128), "pay");
  assert.ok(long.length <= 128 && long.endsWith(".pay"));
  assert.match(long, /^[A-Za-z0-9._:-]{8,128}$/);
});
