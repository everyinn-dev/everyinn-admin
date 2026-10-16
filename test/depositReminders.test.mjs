import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher } from "../src/lib/cores.ts";
import { toLegacyBookingRow } from "../src/lib/coreMappers.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const sampleReminderBooking = {
  id: "bk-dep-1",
  propertyId: "prop-1",
  roomId: "haven-101",
  roomName: "Haven 101",
  roomNumber: "101",
  roomClass: "haven",
  numGuests: 2,
  bookingType: "overnight",
  checkinAt: "2026-10-25T21:00:00.000Z",
  checkoutAt: "2026-10-26T09:00:00.000Z",
  occupiedUntil: "2026-10-26T10:00:00.000Z",
  lateCheckoutHours: 0,
  status: "confirmed",
  note: "Khách cọc qua Zalo",
  closingNote: null,
  guest: {
    name: "Lê Thị B",
    phoneDisplay: "0912345678",
    phoneE164: "+84912345678",
    contactRaw: "0912345678",
    instagram: "lethib",
    facebook: null,
  },
  pricing: {
    basePrice: 490000,
    extraFee: 0,
    discountAmount: 0,
    totalPrice: 490000,
    originalPrice: 490000,
  },
  financial: {
    isDeposit: true,
    depositAmount: 200000,
    paidAmount: 200000,
    remainingAmount: 290000,
    depositDueDate: "2026-10-24",
    depositStatus: "deposit_paid",
    depositPaidAt: "2026-10-20T10:00:00.000Z",
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
    version: 2,
    createdAt: "2026-10-20T10:00:00.000Z",
    createdBy: { id: 1, name: "Staff A" },
    updatedAt: "2026-10-20T10:00:00.000Z",
    updatedBy: { id: 1, name: "Staff A" },
  },
};

test("bookingCore fetches deposit reminders and maps to legacy rows", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/deposit-reminders", (req) => {
    assert.equal(req.url.searchParams.get("date"), "2026-10-24");
    return {
      status: 200,
      headers: { etag: 'W/"dep-rem-test"' },
      body: {
        reminders: [sampleReminderBooking],
        count: 1,
        today: "2026-10-24",
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.get("/internal/v1/deposit-reminders", {
      staff,
      query: { date: "2026-10-24" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.count, 1);
    assert.equal(res.data.today, "2026-10-24");

    const mapped = res.data.reminders.map(toLegacyBookingRow);
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0].id, "bk-dep-1");
    assert.equal(mapped[0].room_name, "Haven 101");
    assert.equal(mapped[0].member_name, "Lê Thị B");
    assert.equal(mapped[0].member_phone, "0912345678");
    assert.equal(mapped[0].is_deposit, 1);
    assert.equal(mapped[0].deposit_status, "deposit_paid");
    assert.equal(mapped[0].deposit_amount, 200000);
    assert.equal(mapped[0].remaining_amount, 290000);
    assert.equal(mapped[0].deposit_due_date, "2026-10-24");
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore deposit reminders supports ETag 304 Not Modified", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/deposit-reminders", (req) => {
    if (req.headers.get("if-none-match") === 'W/"dep-rem-304"') {
      return {
        status: 304,
        headers: { etag: 'W/"dep-rem-304"' },
      };
    }
    return {
      status: 200,
      headers: { etag: 'W/"dep-rem-304"' },
      body: { reminders: [], count: 0, today: "2026-10-24" },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.get("/internal/v1/deposit-reminders", {
      staff,
      query: { date: "2026-10-24" },
      ifNoneMatch: 'W/"dep-rem-304"',
    });

    assert.equal(res.status, 304);
    assert.equal(res.data, null);
    assert.equal(res.etag, 'W/"dep-rem-304"');
  } finally {
    setTestFetcher(null);
  }
});
