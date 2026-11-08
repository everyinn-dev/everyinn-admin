/**
 * LSB-5 — the admin wizard books through the agent-core booking-session engine (same as the guest landing page):
 * session writes go to AGENT_CORE (AdminApi /internal/v1/sessions), the hold DTO is still read from Booking Core,
 * and the Gantt carries live holds + the booking channel for the "🌐 Web" badge.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { setTestFetcher } from "../src/lib/cores.ts";
import { holdOf, sessionIdForHold, sessions } from "../src/lib/sessions.ts";
import { toGanttRoom } from "../src/lib/coreMappers.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const staff = { id: 7, role: "receptionist", full_name: "Lễ Tân B" };
const session = {
  id: "ses_0123456789abcdef",
  ref: "WB-7K2Q",
  holdId: "HLD-20261120-ABCD",
  status: "awaiting_payment",
  statusLabel: "Chờ thanh toán",
  amountDue: 520000,
  paidAmount: 0,
  remaining: 520000,
  bookingId: null,
  expiresAt: "2026-11-20T15:15:00.000Z",
  payment: { amount: 520000, reference: "EIPAY7K2Q", qrUrl: "https://img.vietqr.io/x.png", bankId: "970422", account: "0123", holderName: "EVERY INN" },
  version: 3,
};

function harness() {
  const agent = new FakeCore("agent");
  const booking = new FakeCore("booking");
  setTestFetcher((core) => (core === "agent" ? agent : booking));
  return { agent, booking };
}

test("create → save → partial payment (underpaid) → confirm all go to agent-core with the staff actor", async () => {
  const { agent, booking } = harness();
  agent.on("POST", "/internal/v1/sessions", (req) => {
    assert.equal(req.body.channel ?? "admin", "admin");
    assert.equal(req.body.roomId, "sig-202");
    return { status: 201, body: { session: { ...session, status: "holding", version: 1 }, events: [], payments: [] } };
  });
  agent.on("PATCH", `/internal/v1/sessions/${session.id}`, (req) => {
    assert.equal(req.body.guest.name, "Nguyễn Văn A");
    return { status: 200, body: { session, events: [], payments: [] } };
  });
  agent.on("POST", `/internal/v1/sessions/${session.id}/payments`, (req) => {
    assert.deepEqual(req.body, { amount: 300000, method: "cash" });
    return { status: 200, body: { session: { ...session, status: "underpaid", paidAmount: 300000, remaining: 220000, version: 4 }, events: [], payments: [] } };
  });
  agent.on("POST", `/internal/v1/sessions/${session.id}/accept-short`, () => ({
    status: 200,
    body: { session: { ...session, status: "confirmed", paidAmount: 300000, remaining: 220000, bookingId: "EI-20261120-0001", version: 5 }, events: [], payments: [] },
  }));
  agent.on("GET", `/internal/v1/sessions/by-hold/${session.holdId}`, () => ({ status: 200, body: { sessionId: session.id } }));
  booking.on("GET", `/internal/v1/holds/${session.holdId}`, () => ({ status: 200, body: { hold: { id: session.holdId, payableAmount: 520000 } } }));

  try {
    const created = await sessions.create(staff, { roomId: "sig-202", bookingType: "overnight", clientNonce: "admin-nonce-0001" });
    assert.equal(created.status, 201);
    assert.equal(created.data.session.status, "holding");

    const saved = await sessions.save(staff, session.id, { guest: { name: "Nguyễn Văn A", phone: "0906314109" } });
    assert.equal(saved.data.session.payment.reference, "EIPAY7K2Q");

    const short = await sessions.action(staff, session.id, "payments", { amount: 300000, method: "cash" });
    assert.equal(short.data.session.status, "underpaid");
    assert.equal(short.data.session.remaining, 220000);

    const done = await sessions.action(staff, session.id, "accept-short");
    assert.equal(done.data.session.bookingId, "EI-20261120-0001");

    assert.equal(await sessionIdForHold(staff, session.holdId), session.id);
    assert.equal((await holdOf(staff, session.holdId)).id, session.holdId);

    // every agent-core call carries the admin-bff caller + the real staff actor (audit: who received the money)
    for (const c of agent.calls) {
      assert.equal(c.headers["x-ei-caller"], "admin-bff");
      assert.equal(c.headers["x-ei-actor-id"], "7");
    }
    // writes are never sent to Booking Core holds directly (it would answer 409 SESSION_MANAGED)
    assert.ok(booking.calls.every((c) => c.method === "GET"));
  } finally {
    setTestFetcher(null);
  }
});

test("agent-core errors surface as CoreError (e.g. INVALID_TRANSITION when ✅ was already pressed on Telegram)", async () => {
  const { agent } = harness();
  agent.on("POST", `/internal/v1/sessions/${session.id}/confirm`, () => ({
    status: 409,
    body: { error: { code: "INVALID_TRANSITION", message: "Đơn đã được xác nhận bởi Quản lí lúc 21:07." } },
  }));
  try {
    await assert.rejects(() => sessions.action(staff, session.id, "confirm"), (err) => err.status === 409 && err.code === "INVALID_TRANSITION");
  } finally {
    setTestFetcher(null);
  }
});

test("Gantt mapping keeps live holds and the booking channel (also in the compact month view)", () => {
  const room = {
    id: "sig-202",
    roomNumber: "202",
    name: "Signature 202",
    roomClass: "signature",
    floor: 2,
    bookings: [{ id: "EI-1", roomId: "sig-202", guestName: "A", phone: "0906", channel: "web", voucherCode: "TEM3-8KQ2", bookingType: "overnight", checkinAt: "2026-11-20T15:00:00Z", checkoutAt: "2026-11-21T03:00:00Z", status: "confirmed" }],
    blocks: [],
    holds: [{ id: "HLD-1", bookingType: "hourly", checkinAt: "2026-11-20T07:00:00Z", checkoutAt: "2026-11-20T10:00:00Z", status: "awaiting_payment", expiresAt: "2026-11-20T07:10:00Z", remainingSeconds: 300, payableAmount: 320000, channel: "web", sessionId: session.id, guestNameMasked: "N*** A" }],
  };
  const day = toGanttRoom(room, true);
  assert.equal(day.bookings[0].channel, "web");
  assert.equal(day.bookings[0].voucherCode, "TEM3-8KQ2");
  assert.equal(day.holds.length, 1);
  assert.equal(day.holds[0].sessionId, session.id);
  assert.equal("remainingSeconds" in day.holds[0], false, "countdown is computed client-side from expiresAt");
  const month = toGanttRoom(room, false);
  assert.equal(month.bookings[0].channel, "web");
  assert.equal(toGanttRoom({ ...room, holds: undefined }, true).holds.length, 0);
});
