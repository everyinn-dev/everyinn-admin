import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher, newIdempotencyKey } from "../src/lib/cores.ts";
import { toLegacyBookingRow } from "../src/lib/coreMappers.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const sampleBookingDto = {
  id: "bk-detail-1",
  propertyId: "prop-1",
  roomId: "rm-101",
  roomName: "Phòng 101",
  roomClass: "standard",
  numGuests: 2,
  bookingType: "dayuse",
  checkinAt: "2026-10-20T10:00:00.000Z",
  checkoutAt: "2026-10-20T14:00:00.000Z",
  occupiedUntil: "2026-10-20T15:00:00.000Z",
  lateCheckoutHours: 0,
  status: "confirmed",
  note: "Khách quen",
  closingNote: null,
  guest: {
    name: "Nguyễn Văn A",
    phoneDisplay: "0901234567",
    phoneE164: "+84901234567",
    contactRaw: "0901234567",
    instagram: null,
    facebook: null,
  },
  pricing: {
    basePrice: 300000,
    extraFee: 0,
    discountAmount: 0,
    totalPrice: 300000,
    originalPrice: 300000,
  },
  financial: {
    isDeposit: true,
    depositAmount: 100000,
    paidAmount: 100000,
    remainingAmount: 200000,
    depositDueDate: "2026-10-19T10:00:00.000Z",
    depositStatus: "deposit_paid",
    depositPaidAt: "2026-10-18T10:00:00.000Z",
    depositReminderSentAt: null,
    depositReminderSentBy: null,
    remainingPaidAt: null,
    remainingPaidBy: null,
    refundAmount: 0,
  },
  lifecycle: {
    cancelledAt: null,
    cancelReason: null,
    cancelledBy: null,
    noShowAt: null,
    noShowReason: null,
    noShowBy: null,
  },
  control: {
    version: 3,
    createdAt: "2026-10-18T09:00:00.000Z",
    createdBy: { id: 1, name: "Staff A" },
    updatedAt: "2026-10-18T10:00:00.000Z",
    updatedBy: { id: 1, name: "Staff A" },
  },
};

test("bookingCore.get fetches single booking and maps to legacy row", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/bookings/bk-detail-1", () => ({
    status: 200,
    headers: { etag: '"v3"' },
    body: {
      booking: sampleBookingDto,
      financialEntries: [],
      loyaltyOutbox: [],
      audit: [],
    },
  }));

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.get("/internal/v1/bookings/bk-detail-1", { staff });
    assert.equal(res.status, 200);

    const mapped = toLegacyBookingRow(res.data.booking);
    assert.equal(mapped.id, "bk-detail-1");
    assert.equal(mapped.room_name, "Phòng 101");
    assert.equal(mapped.member_phone, "0901234567");
    assert.equal(mapped.member_name, "Nguyễn Văn A");
    assert.equal(mapped.total_price, 300000);
    assert.equal(mapped.remaining_amount, 200000);
    assert.equal(mapped.mod_no, 3);
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.post handles extend action with expectedVersion and idempotency key", async () => {
  const fake = new FakeCore("booking");
  let extendPayload = null;

  fake.on("POST", "/internal/v1/bookings/bk-detail-1/extend", (req) => {
    extendPayload = req.body;
    return {
      status: 200,
      body: {
        booking: {
          ...sampleBookingDto,
          checkoutAt: "2026-10-20T15:00:00.000Z",
          control: { ...sampleBookingDto.control, version: 4 },
        },
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.post("/internal/v1/bookings/bk-detail-1/extend", {
      staff,
      idempotencyKey: newIdempotencyKey("booking-extend"),
      body: { expectedVersion: 3, hours: 1 },
    });

    assert.equal(res.status, 200);
    const mapped = toLegacyBookingRow(res.data.booking);
    assert.equal(mapped.mod_no, 4);
    assert.deepEqual(extendPayload, { expectedVersion: 3, hours: 1 });
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.post handles no-show action with refund", async () => {
  const fake = new FakeCore("booking");
  let noShowPayload = null;

  fake.on("POST", "/internal/v1/bookings/bk-detail-1/no-show", (req) => {
    noShowPayload = req.body;
    return {
      status: 200,
      body: {
        booking: {
          ...sampleBookingDto,
          status: "no_show",
          control: { ...sampleBookingDto.control, version: 4 },
        },
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.post("/internal/v1/bookings/bk-detail-1/no-show", {
      staff,
      idempotencyKey: newIdempotencyKey("booking-noshow"),
      body: {
        expectedVersion: 3,
        reason: "Khách hủy sát giờ",
        refund: { amount: 50000, method: "cash" },
      },
    });

    assert.equal(res.status, 200);
    const mapped = toLegacyBookingRow(res.data.booking);
    assert.equal(mapped.status, "no_show");
    assert.equal(noShowPayload.reason, "Khách hủy sát giờ");
    assert.deepEqual(noShowPayload.refund, { amount: 50000, method: "cash" });
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.post handles cancel action", async () => {
  const fake = new FakeCore("booking");
  let cancelPayload = null;

  fake.on("POST", "/internal/v1/bookings/bk-detail-1/cancel", (req) => {
    cancelPayload = req.body;
    return {
      status: 200,
      body: {
        booking: {
          ...sampleBookingDto,
          status: "cancelled",
          control: { ...sampleBookingDto.control, version: 4 },
        },
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.post("/internal/v1/bookings/bk-detail-1/cancel", {
      staff,
      idempotencyKey: newIdempotencyKey("booking-cancel"),
      body: {
        expectedVersion: 3,
        reason: "Lễ tân hủy đặt phòng",
      },
    });

    assert.equal(res.status, 200);
    const mapped = toLegacyBookingRow(res.data.booking);
    assert.equal(mapped.status, "cancelled");
    assert.equal(cancelPayload.expectedVersion, 3);
  } finally {
    setTestFetcher(null);
  }
});
