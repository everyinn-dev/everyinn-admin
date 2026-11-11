import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher, newIdempotencyKey } from "../src/lib/cores.ts";
import { buildBookingTelegramHtml, sendTelegramBookingNotification } from "../src/lib/telegram.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const sampleHold = {
  id: "HLD-20261016-ABCD",
  roomId: "haven-101",
  roomName: "Haven 101",
  roomNumber: "101",
  roomClass: "haven",
  bookingType: "hourly",
  ratePlanCode: "combo3h",
  checkinAt: "2026-10-16T07:00:00Z",
  checkoutAt: "2026-10-16T10:00:00Z",
  occupiedUntil: "2026-10-16T11:00:00Z",
  lateCheckoutHours: 0,
  numGuests: 2,
  quotedSubtotal: 320000,
  quotedTotalPrice: 320000,
  status: "active",
  expiresAt: "2026-10-16T07:15:00Z",
  expiresAtSec: 1792134900,
  remainingSeconds: 900,
  draft: {
    guest: {
      name: "Nguyen Van A",
      phone: "0901234567",
      instagram: "nguyenvana",
      facebook: null,
      zalo: null,
    },
    numGuests: 2,
    promotionCode: null,
    paymentOption: "full",
    depositAmount: 0,
    payableAmount: 320000,
    closingNote: "Đã chốt khách qua IG",
    note: null,
  },
  convertedBookingId: null,
  createdBy: { id: 1, name: "Lễ Tân A" },
  createdAt: "2026-10-16T07:00:00Z",
  updatedAt: "2026-10-16T07:00:00Z",
};

const sampleConfirmedBooking = {
  id: "EI-20261016-0099",
  propertyId: "everyinn-saigon",
  roomClass: "haven",
  roomId: "haven-101",
  roomName: "Haven 101",
  roomNumber: "101",
  customerId: "cdp_cust_1",
  guest: {
    phone: "+84901234567",
    phoneDisplay: "0901234567",
    contactRaw: "IG:nguyenvana",
    name: "Nguyen Van A",
    instagram: "nguyenvana",
    facebook: null,
    zalo: null,
  },
  numGuests: 2,
  bookingType: "hourly",
  ratePlanCode: "combo3h",
  checkinAt: "2026-10-16T07:00:00Z",
  checkoutAt: "2026-10-16T10:00:00Z",
  occupiedUntil: "2026-10-16T11:00:00Z",
  lateCheckoutHours: 0,
  status: "confirmed",
  source: "admin",
  note: null,
  closingNote: "Đã chốt khách qua IG",
  pricing: {
    currency: "VND",
    comboLabel: "Combo 3h",
    durationLabel: "3 giờ",
    rateRule: { id: "rate-haven-combo3h", version: 1, basePrice: 320000, extraHourFee: 60000 },
    basePrice: 320000,
    extraFee: 0,
    subtotal: 320000,
    promotionDiscount: 0,
    loyaltyDiscount: 0,
    discountAmount: 0,
    totalPrice: 320000,
    originalPrice: 320000,
    lines: [],
    isFinal: true,
  },
  promotion: null,
  loyalty: {
    syncStatus: "synced",
    step: 1,
    tier: "bronze",
    reward: null,
    syncedAt: "2026-10-16T07:05:00Z",
  },
  financial: {
    isDeposit: false,
    depositAmount: 0,
    paidAmount: 320000,
    refundAmount: 0,
    netPaid: 320000,
    remainingAmount: 0,
    overpaidAmount: 0,
    depositStatus: "none",
    depositDueDate: null,
    depositPaidAt: null,
    depositReminderSentAt: null,
    depositReminderSentBy: null,
    remainingPaidAt: "2026-10-16T07:05:00Z",
    remainingPaidBy: { id: 1, name: "Lễ Tân A" },
  },
  lifecycle: {
    confirmedAt: "2026-10-16T07:05:00Z",
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    closureReasonCode: null,
    noShowAt: null,
    noShowBy: null,
    noShowReason: null,
  },
  control: {
    version: 1,
    createdAt: "2026-10-16T07:05:00Z",
    createdBy: { id: 1, name: "Lễ Tân A" },
    updatedAt: "2026-10-16T07:05:00Z",
    updatedBy: { id: 1, name: "Lễ Tân A" },
  },
  reconciliationStatus: "ok",
};

test("Phase 2.1 BFF flow: search availability -> create hold -> update draft -> confirm payment", async () => {
  const fake = new FakeCore("booking");

  fake.on("POST", "/internal/v1/availability/search", (req) => {
    assert.equal(req.body.bookingType, "hourly");
    assert.equal(req.body.numGuests, 2);
    return {
      status: 200,
      body: {
        bookingType: "hourly",
        ratePlanCode: "combo3h",
        checkinAt: req.body.checkinAt,
        checkoutAt: req.body.checkoutAt,
        occupiedUntil: "2026-10-16T11:00:00Z",
        numGuests: 2,
        rooms: [
          {
            roomId: "haven-101",
            roomName: "Haven 101",
            roomNumber: "101",
            roomClass: "haven",
            floor: 1,
            maxGuests: 2,
            available: true,
            unavailableReason: null,
            conflicts: [],
            quote: {
              currency: "VND",
              comboLabel: "Combo 3h",
              durationLabel: "3 giờ",
              basePrice: 320000,
              extraFee: 0,
              subtotal: 320000,
              lines: [],
            },
          },
        ],
      },
    };
  });

  fake.on("POST", "/internal/v1/holds", (req) => {
    assert.ok(req.headers["idempotency-key"]);
    assert.equal(req.body.roomId, "haven-101");
    return { status: 201, body: { hold: sampleHold } };
  });

  fake.on("PATCH", "/internal/v1/holds/HLD-20261016-ABCD", (req) => {
    assert.ok(req.headers["idempotency-key"]);
    assert.equal(req.body.draft.guest.name, "Nguyen Van A");
    return { status: 200, body: { hold: sampleHold } };
  });

  fake.on("POST", "/internal/v1/holds/HLD-20261016-ABCD/confirm", (req) => {
    assert.ok(req.headers["idempotency-key"]);
    return {
      status: 201,
      body: {
        hold: { ...sampleHold, status: "confirmed", convertedBookingId: sampleConfirmedBooking.id, remainingSeconds: 0 },
        booking: sampleConfirmedBooking,
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "receptionist", full_name: "Lễ Tân A" };

    const searchRes = await bookingCore.post("/internal/v1/availability/search", {
      staff,
      body: {
        bookingType: "hourly",
        checkinAt: "2026-10-16T07:00:00Z",
        checkoutAt: "2026-10-16T10:00:00Z",
        numGuests: 2,
      },
    });
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.data.rooms.length, 1);
    assert.equal(searchRes.data.rooms[0].quote.subtotal, 320000);

    const holdRes = await bookingCore.post("/internal/v1/holds", {
      staff,
      idempotencyKey: newIdempotencyKey("hold-create"),
      body: {
        roomId: "haven-101",
        bookingType: "hourly",
        checkinAt: "2026-10-16T07:00:00Z",
        checkoutAt: "2026-10-16T10:00:00Z",
        numGuests: 2,
      },
    });
    assert.equal(holdRes.status, 201);
    assert.equal(holdRes.data.hold.id, "HLD-20261016-ABCD");

    const draftRes = await bookingCore.patch("/internal/v1/holds/HLD-20261016-ABCD", {
      staff,
      idempotencyKey: newIdempotencyKey("hold-draft"),
      body: { draft: sampleHold.draft },
    });
    assert.equal(draftRes.status, 200);

    const confirmRes = await bookingCore.post("/internal/v1/holds/HLD-20261016-ABCD/confirm", {
      staff,
      idempotencyKey: newIdempotencyKey("hold-confirm"),
      body: { paymentMethod: "bank_transfer" },
    });
    assert.equal(confirmRes.status, 201);
    assert.equal(confirmRes.data.booking.id, "EI-20261016-0099");
  } finally {
    setTestFetcher(null);
  }
});

test("Telegram notification builder formats HTML safely and skips gracefully when unconfigured", async () => {
  const staff = { id: 1, full_name: "Lễ Tân A" };
  const html = buildBookingTelegramHtml(sampleConfirmedBooking, staff, "HLD-20261016-ABCD");
  assert.match(html, /ĐẶT PHÒNG MỚI ĐÃ THANH TOÁN \(#EI-20261016-0099\)/);
  assert.match(html, /Haven 101/);
  assert.match(html, /Nguyen Van A/);
  assert.match(html, /IG: nguyenvana/);
  assert.match(html, /Lễ Tân A/);
  assert.match(html, /HLD-20261016-ABCD/);

  // Without TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID, returns { sent: false, reason: "MISSING_CREDENTIALS" }
  const res = await sendTelegramBookingNotification(sampleConfirmedBooking, staff);
  assert.equal(res.sent, false);
  assert.equal(res.reason, "MISSING_CREDENTIALS");
});
