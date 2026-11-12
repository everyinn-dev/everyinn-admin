import test from "node:test";
import assert from "node:assert/strict";
import { hasMoneyReason, initialCustomPrice, moneyEditState } from "../src/lib/bookingEdit.ts";

const base = {
  originalType: "custom",
  originalCustomPrice: 1_000_000,
  customPrice: 1_000_000,
  originalIncidentalFee: 0,
  originalIncidentalReason: "",
  showIncidental: false,
  incidentalFee: 0,
  incidentalReason: "",
};

test("custom price starts from the BASE price, not the discounted / extended total (no drift on save)", () => {
  // base 1.000.000, promotion -100.000, +1h extension 60.000, incidental 50.000 → total 1.010.000
  const booking = { base_price: 1_000_000, total_price: 1_010_000, incidental_fee: 50_000 };
  assert.equal(initialCustomPrice(booking), 1_000_000);
  assert.equal(initialCustomPrice({ basePrice: 800_000, totalPrice: 700_000 }), 800_000);
  // legacy row without a base price: fall back to the stay total without the incidental charge
  assert.equal(initialCustomPrice({ total_price: 900_000, incidental_fee: 100_000 }), 800_000);
  assert.equal(initialCustomPrice({}), 0);
});

test("an untouched form is not a money change: no reason needed, nothing re-priced", () => {
  const s = moneyEditState(base);
  assert.deepEqual(s, { activeIncidental: 0, customPriceChanged: false, incidentalChanged: false, needsReason: false });
  assert.equal(hasMoneyReason(s, "", ""), true);
});

test("changing the custom price needs a reason; only custom bookings have a custom price", () => {
  const changed = moneyEditState({ ...base, customPrice: 950_000 });
  assert.equal(changed.customPriceChanged, true);
  assert.equal(hasMoneyReason(changed, "", ""), false);
  assert.equal(hasMoneyReason(changed, "Khách quen", ""), true);
  const hourly = moneyEditState({ ...base, originalType: "hourly", customPrice: 123 });
  assert.equal(hourly.customPriceChanged, false);
});

test("adding / changing / removing an incidental charge needs a reason; the charge's own description counts when it is set", () => {
  const added = moneyEditState({ ...base, showIncidental: true, incidentalFee: 150_000, incidentalReason: "Đền bù vỡ ly" });
  assert.equal(added.incidentalChanged, true);
  assert.equal(hasMoneyReason(added, "", "Đền bù vỡ ly"), true);
  assert.equal(hasMoneyReason(added, "", ""), false);

  const existing = { ...base, originalIncidentalFee: 150_000, originalIncidentalReason: "Đền bù vỡ ly" };
  const same = moneyEditState({ ...existing, showIncidental: true, incidentalFee: 150_000, incidentalReason: "Đền bù vỡ ly" });
  assert.equal(same.needsReason, false);
  const reworded = moneyEditState({ ...existing, showIncidental: true, incidentalFee: 150_000, incidentalReason: "Vỡ 2 ly" });
  assert.equal(reworded.needsReason, true);
  // removing a charge never disappears silently: the description no longer counts, a reason is mandatory
  const removed = moneyEditState({ ...existing, showIncidental: false, incidentalFee: 0, incidentalReason: "" });
  assert.equal(removed.incidentalChanged, true);
  assert.equal(hasMoneyReason(removed, "", "Đền bù vỡ ly"), false);
  assert.equal(hasMoneyReason(removed, "Khách đã tự thanh toán", ""), true);
});
