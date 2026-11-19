import test from "node:test";
import assert from "node:assert/strict";
import { balanceOf, canReverse, planLedgerAction } from "../src/lib/ledger.ts";
import { balanceHint } from "../src/lib/editPricing.ts";

const NOW = Date.parse("2026-11-19T05:00:00Z");

test("ledger: a payment carries the method and WHEN the money moved (VN datetime-local → ISO) — B5", () => {
  const r = planLedgerAction({ action: "payment", amount: "500000", method: "bank_transfer", occurredAt: "2026-11-18T21:30", reason: " VCB " }, NOW);
  assert.deepEqual(r, { ok: true, kind: "entry", body: { entryType: "payment", amount: 500000, method: "bank_transfer", reason: "VCB", occurredAt: "2026-11-18T14:30:00.000Z" } });
  // no date → Core stamps "now"
  assert.deepEqual(planLedgerAction({ action: "payment", amount: 1000, method: "cash" }, NOW), { ok: true, kind: "entry", body: { entryType: "payment", amount: 1000, method: "cash" } });
});

test("ledger: invalid input is refused before reaching Core", () => {
  assert.equal(planLedgerAction({ action: "payment", amount: 0, method: "cash" }, NOW).ok, false);
  assert.equal(planLedgerAction({ action: "payment", amount: -5, method: "cash" }, NOW).ok, false);
  assert.equal(planLedgerAction({ action: "payment", amount: 5, method: "crypto" }, NOW).ok, false);
  assert.equal(planLedgerAction({ action: "payment", amount: 5, method: "cash", occurredAt: "2026-11-20T10:00" }, NOW).ok, false); // future
  assert.equal(planLedgerAction({ action: "refund", amount: 5, method: "cash" }, NOW).ok, false); // reason required
  assert.equal(planLedgerAction({ action: "adjustment", amount: -50000, method: "other" }, NOW).ok, false); // reason required
  assert.equal(planLedgerAction({ action: "reverse", entryId: "fin_1" }, NOW).ok, false); // reason required
  assert.equal(planLedgerAction({ action: "delete" }, NOW).ok, false);
});

test("ledger: refund, signed adjustment and reversal plans — B7", () => {
  const refund = planLedgerAction({ action: "refund", amount: 50000, method: "cash", reason: "Hoàn phần thu thừa" }, NOW);
  assert.equal(refund.ok && refund.kind === "entry" && refund.body.entryType, "refund");
  const adj = planLedgerAction({ action: "adjustment", amount: -50000, method: "other", reason: "Loyalty giảm sau khi thu" }, NOW);
  assert.equal(adj.ok && adj.kind === "entry" && adj.body.amount, -50000);
  assert.deepEqual(planLedgerAction({ action: "reverse", entryId: "fin_1", reason: "Ghi nhầm" }, NOW), { ok: true, kind: "reverse", entryId: "fin_1", body: { reason: "Ghi nhầm" } });
});

test("ledger: each entry reversible once; balance never hides an overpayment", () => {
  const e = (id, entryType, reversesEntryId = null) => ({ id, entryType, reversesEntryId });
  const all = [e("a", "payment"), e("b", "reversal", "a"), e("c", "refund")];
  assert.equal(canReverse(all[0], all), false); // already reversed
  assert.equal(canReverse(all[1], all), false); // a reversal
  assert.equal(canReverse(all[2], all), true);
  assert.deepEqual(balanceOf({ totalPrice: 256000, paidAmount: 306000, refundAmount: 0, status: "confirmed" }), { netReceived: 306000, due: 0, overpaid: 50000 });
  assert.deepEqual(balanceOf({ totalPrice: 500000, paidAmount: 200000, refundAmount: 0, status: "confirmed" }), { netReceived: 200000, due: 300000, overpaid: 0 });
  assert.deepEqual(balanceOf({ totalPrice: 500000, paidAmount: 200000, refundAmount: 0, status: "cancelled" }), { netReceived: 200000, due: 0, overpaid: 0 });
});

test("edit pricing: the balance hint follows the chosen mode — B6", () => {
  const opt = (total, balance) => ({ total, balance, basePrice: 0, holidaySurcharge: 0, extraGuestFee: 0, extraFee: 0, promotionDiscount: 0, loyaltyDiscount: 0, promotionDropped: false });
  const q = { bookingId: "x", currentTotal: 1000000, netReceived: 1000000, pastCheckout: false, keepAgreed: opt(1500000, 500000), currentRates: opt(900000, -100000), choiceRequired: true };
  assert.deepEqual(balanceHint(q, "keep_agreed"), { kind: "collect", amount: 500000 });
  assert.deepEqual(balanceHint(q, "current_rates"), { kind: "refund", amount: 100000 });
});
