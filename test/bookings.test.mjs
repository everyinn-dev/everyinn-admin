import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher, newIdempotencyKey } from "../src/lib/cores.ts";
import { toLegacyBookingRow } from "../src/lib/coreMappers.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const sampleBookingCanonical = {
  id: "EI-20261016-0001",
  propertyId: "everyinn-saigon",
  roomClass: "haven",
  roomId: "room_haven_1",
  roomName: "Haven 1",
  roomNumber: "101",
  customerId: "cdp_cust_1",
  guest: {
    phone: "+84901234567",
    phoneDisplay: "0901 234 567",
    contactRaw: "0901234567",
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
  closingNote: null,
  pricing: {
    currency: "VND",
    comboLabel: "Combo 3h",
    durationLabel: "3 giờ",
    rateRule: { id: "rate_1", version: 1, basePrice: 350000, extraHourFee: 50000 },
    basePrice: 350000,
    extraFee: 0,
    subtotal: 350000,
    promotionDiscount: 0,
    loyaltyDiscount: 0,
    discountAmount: 0,
    totalPrice: 350000,
    originalPrice: 350000,
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
    paidAmount: 350000,
    refundAmount: 0,
    netPaid: 350000,
    remainingAmount: 0,
    overpaidAmount: 0,
    depositStatus: "none",
    depositDueDate: null,
    depositPaidAt: null,
    depositReminderSentAt: null,
    depositReminderSentBy: null,
    remainingPaidAt: "2026-10-16T07:00:00Z",
    remainingPaidBy: { id: 1, name: "Manager" },
  },
  lifecycle: {
    confirmedAt: "2026-10-16T06:00:00Z",
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    noShowAt: null,
    noShowBy: null,
    noShowReason: null,
  },
  control: {
    version: 1,
    createdAt: "2026-10-16T06:00:00Z",
    createdBy: { id: 1, name: "Manager" },
    updatedAt: "2026-10-16T06:00:00Z",
    updatedBy: { id: 1, name: "Manager" },
  },
  reconciliationStatus: "ok",
};

test("bookingCore.get fetches list of bookings and maps to legacy rows", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/bookings", (req) => {
    assert.equal(req.query.date, "2026-10-16");
    assert.equal(req.query.status, "confirmed");
    return {
      status: 200,
      headers: { etag: '"v1"' },
      body: {
        bookings: [sampleBookingCanonical],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager" };
    const res = await bookingCore.get("/internal/v1/bookings", {
      staff,
      query: { date: "2026-10-16", status: "confirmed" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.total, 1);
    const rows = res.data.bookings.map((b) => toLegacyBookingRow(b));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "EI-20261016-0001");
    assert.equal(rows[0].room_name, "Haven 1");
    assert.equal(rows[0].total_price, 350000);
    assert.equal(rows[0].version, 1);
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.get supports 304 Not Modified when ETag matches", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/bookings", (req) => {
    if (req.headers && req.headers["if-none-match"] === '"v1"') {
      return { status: 304 };
    }
    return { status: 200, headers: { etag: '"v1"' }, body: { bookings: [], total: 0 } };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager" };
    const res = await bookingCore.get("/internal/v1/bookings", {
      staff,
      ifNoneMatch: '"v1"',
    });

    assert.equal(res.status, 304);
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore quote and booking create flow with idempotency key", async () => {
  const fake = new FakeCore("booking");

  fake.on("POST", "/internal/v1/quotes", (req) => {
    assert.equal(req.body.bookingType, "hourly");
    assert.equal(req.body.roomId, "room_haven_1");
    return {
      status: 200,
      body: {
        quote: {
          subtotal: 350000,
          totalBeforeLoyalty: 350000,
          estimatedTotal: 350000,
          promotion: null,
        },
        availability: { available: true, conflicts: [] },
      },
    };
  });

  fake.on("POST", "/internal/v1/bookings", (req) => {
    assert.ok(req.headers["idempotency-key"]);
    assert.equal(req.body.roomId, "room_haven_1");
    assert.equal(req.body.guest.name, "Nguyen Van A");
    return {
      status: 201,
      body: {
        booking: sampleBookingCanonical,
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager" };
    const quoteRes = await bookingCore.post("/internal/v1/quotes", {
      staff,
      body: {
        bookingType: "hourly",
        roomId: "room_haven_1",
        checkinAt: "2026-10-16T07:00:00Z",
        checkoutAt: "2026-10-16T10:00:00Z",
      },
    });

    assert.equal(quoteRes.status, 200);
    assert.equal(quoteRes.data.availability.available, true);
    assert.equal(quoteRes.data.quote.estimatedTotal, 350000);

    const createRes = await bookingCore.post("/internal/v1/bookings", {
      staff,
      idempotencyKey: newIdempotencyKey("booking-create"),
      body: {
        roomId: "room_haven_1",
        guest: {
          name: "Nguyen Van A",
          phone: "0901234567",
        },
        bookingType: "hourly",
        checkinAt: "2026-10-16T07:00:00Z",
        checkoutAt: "2026-10-16T10:00:00Z",
      },
    });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.booking.id, "EI-20261016-0001");
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore handles 409 conflict when room is unavailable", async () => {
  const fake = new FakeCore("booking");
  fake.on("POST", "/internal/v1/bookings", () => {
    return {
      status: 409,
      body: {
        error: {
          code: "SLOT_CONFLICT",
          message: "Phòng đã có khách đặt trong khung giờ này.",
        },
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "receptionist", full_name: "Receptionist" };
    await assert.rejects(
      async () => {
        await bookingCore.post("/internal/v1/bookings", {
          staff,
          idempotencyKey: newIdempotencyKey("booking-create"),
          body: { roomId: "room_haven_1" },
        });
      },
      (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, "SLOT_CONFLICT");
        return true;
      }
    );
  } finally {
    setTestFetcher(null);
  }
});
