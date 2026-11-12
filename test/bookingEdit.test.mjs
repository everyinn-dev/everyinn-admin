import test from "node:test";
import assert from "node:assert/strict";
import { hasMoneyReason, initialCustomPrice, moneyEditState } from "../src/lib/bookingEdit.ts";

const base = { originalType: "custom", originalCustomPrice: 1_000_000, customPrice: 1_000_000 };

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
  assert.deepEqual(s, { customPriceChanged: false, needsReason: false });
  assert.equal(hasMoneyReason(s, ""), true);
});

test("changing the custom price needs a reason; only custom bookings have a custom price", () => {
  const changed = moneyEditState({ ...base, customPrice: 950_000 });
  assert.equal(changed.customPriceChanged, true);
  assert.equal(hasMoneyReason(changed, ""), false);
  assert.equal(hasMoneyReason(changed, "  "), false);
  assert.equal(hasMoneyReason(changed, "Khách quen"), true);
  const hourly = moneyEditState({ ...base, originalType: "hourly", customPrice: 123 });
  assert.equal(hourly.customPriceChanged, false);
});
