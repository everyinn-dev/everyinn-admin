import test from "node:test";
import assert from "node:assert/strict";
import { fullPaymentKey, planCollection } from "../src/lib/bookingCollection.ts";

test("collection: an older client that says nothing is NEVER recorded as paid in full (ontology invariant 8)", () => {
  assert.deepEqual(planCollection({}), { ok: true, plan: { mode: "none", method: "cash" } });
  assert.deepEqual(planCollection({ isDeposit: false }), { ok: true, plan: { mode: "none", method: "cash" } });
});

test("collection: legacy isDeposit maps to a deposit of the typed amount with its due date", () => {
  const r = planCollection({ isDeposit: true, depositAmount: 300000.4, depositDueDate: "2026-12-01" });
  assert.deepEqual(r, { ok: true, plan: { mode: "deposit", method: "cash", deposit: { amount: 300000, method: "cash", dueDate: "2026-12-01" } } });
});

test("collection: explicit modes carry the chosen payment method", () => {
  assert.deepEqual(planCollection({ collection: "full", paymentMethod: "bank_transfer" }), { ok: true, plan: { mode: "full", method: "bank_transfer" } });
  const dep = planCollection({ collection: "deposit", paymentMethod: "card", depositAmount: 100000 });
  assert.equal(dep.ok && dep.plan.deposit?.method, "card");
  // explicit "none" wins over a stale isDeposit flag
  assert.deepEqual(planCollection({ collection: "none", isDeposit: true }), { ok: true, plan: { mode: "none", method: "cash" } });
});

test("collection: invalid input is rejected", () => {
  assert.equal(planCollection({ collection: "paid" }).ok, false);
  assert.equal(planCollection({ collection: "full", paymentMethod: "crypto" }).ok, false);
  assert.equal(planCollection({ collection: "deposit", depositAmount: 0 }).ok, false);
});

test("collection: the full-payment key is derived from the create key and stays within Core's 128 chars", () => {
  assert.equal(fullPaymentKey("adm.booking-create.abc12345"), "adm.booking-create.abc12345.full");
  const long = "k".repeat(128);
  assert.ok(fullPaymentKey(long).length <= 128);
  assert.match(fullPaymentKey(long), /^[A-Za-z0-9._:-]{8,128}$/);
});
