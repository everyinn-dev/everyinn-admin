import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher } from "../src/lib/cores.ts";
import { toDailyRosterResponse } from "../src/lib/coreMappers.ts";
import { applyDoorCodes, applyOpsStates } from "../src/lib/rosterDoorCodes.ts";
import { chunkArray } from "../src/lib/doorCodeUtils.ts";
import { formatDateTimeShort, formatTimeShort } from "../src/lib/timelineUtils.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const sampleCheckinItem = {
  id: "bk-roster-1",
  roomId: "haven-101",
  roomName: "Haven 101",
  roomNumber: "101",
  roomClass: "haven",
  guestName: "Trần Thị C",
  phone: "0987654321",
  instagram: "tranthic",
  facebook: null,
  bookingType: "hourly",
  ratePlanCode: "combo3h",
  checkinAt: "2026-10-24T14:00:00.000Z",
  checkoutAt: "2026-10-24T17:00:00.000Z",
  turnoverStartAt: "2026-10-24T17:00:00.000Z",
  turnoverEndAt: "2026-10-24T18:00:00.000Z",
  lateCheckoutHours: 0,
  totalPrice: 320000,
  remainingAmount: 0,
  status: "confirmed",
  loyaltySyncStatus: "pending",
  loyaltyTier: "bronze",
  loyaltyStep: 2,
  closingNote: null,
  note: "Khách hẹn đúng 14h",
  createdAt: "2026-10-20T10:00:00.000Z",
  createdBy: { id: 1, name: "Staff A" },
  updatedAt: "2026-10-20T10:00:00.000Z",
  version: 1,
};

const sampleCheckoutItem = {
  id: "bk-roster-2",
  roomId: "sig-202",
  roomName: "Signature 202",
  roomNumber: "202",
  roomClass: "signature",
  guestName: "Phạm Văn D",
  phone: "0933112233",
  instagram: null,
  facebook: "phamvand",
  bookingType: "overnight",
  ratePlanCode: "overnight",
  checkinAt: "2026-10-23T21:00:00.000Z",
  checkoutAt: "2026-10-24T09:00:00.000Z",
  turnoverStartAt: "2026-10-24T09:00:00.000Z",
  turnoverEndAt: "2026-10-24T10:00:00.000Z",
  lateCheckoutHours: 1,
  totalPrice: 680000,
  remainingAmount: 0,
  status: "confirmed",
  loyaltySyncStatus: "synced",
  loyaltyTier: "silver",
  loyaltyStep: 5,
  closingNote: "Đã dọn phòng xong",
  note: null,
  createdAt: "2026-10-19T10:00:00.000Z",
  createdBy: { id: 2, name: "Staff B" },
  updatedAt: "2026-10-24T09:30:00.000Z",
  version: 3,
};

test("bookingCore fetches daily roster and maps to DailyRosterResponse shape", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/daily-roster", (req) => {
    assert.equal(req.url.searchParams.get("date"), "2026-10-24");
    return {
      status: 200,
      headers: { etag: 'W/"roster-2026-10-24"' },
      body: {
        date: "2026-10-24",
        summary: {
          totalCheckins: 1,
          totalCheckouts: 1,
          hourlyCount: 1,
          overnightCount: 0,
          dayuseCount: 0,
          customCount: 0,
          loyaltyPendingCount: 1,
        },
        checkins: [sampleCheckinItem],
        checkouts: [sampleCheckoutItem],
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.get("/internal/v1/daily-roster", {
      staff,
      query: { date: "2026-10-24" },
    });

    assert.equal(res.status, 200);
    const mapped = toDailyRosterResponse(res.data);

    assert.equal(mapped.date, "2026-10-24");
    assert.equal(mapped.summary.totalCheckins, 1);
    assert.equal(mapped.summary.totalCheckouts, 1);
    assert.equal(mapped.summary.hourlyCount, 1);
    assert.equal(mapped.summary.doorCodeMissingCount, 1); // 1 checkin without doorCode

    // Check check-in item mapping
    assert.equal(mapped.checkins.length, 1);
    const ci = mapped.checkins[0];
    assert.equal(ci.id, "bk-roster-1");
    assert.equal(ci.roomId, "haven-101");
    assert.equal(ci.roomNumber, "101");
    assert.equal(ci.floor, 1);
    assert.equal(ci.guestName, "Trần Thị C");
    assert.equal(ci.bookingType, "hourly");
    assert.equal(ci.turnoverStartAt, "2026-10-24T17:00:00.000Z");
    assert.equal(ci.turnoverEndAt, "2026-10-24T18:00:00.000Z");
    assert.equal(ci.modNo, 1);

    // Check check-out item mapping
    assert.equal(mapped.checkouts.length, 1);
    const co = mapped.checkouts[0];
    assert.equal(co.id, "bk-roster-2");
    assert.equal(co.roomId, "sig-202");
    assert.equal(co.roomNumber, "202");
    assert.equal(co.floor, 2);
    assert.equal(co.guestName, "Phạm Văn D");
    assert.equal(co.bookingType, "overnight");
    assert.equal(co.lateCheckoutHours, 1);
    assert.equal(co.closingNote, "Đã dọn phòng xong");
    assert.equal(co.modNo, 3);
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore daily roster supports ETag 304 Not Modified", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/daily-roster", (req) => {
    if (req.headers.get("if-none-match") === 'W/"roster-304"') {
      return {
        status: 304,
        headers: { etag: 'W/"roster-304"' },
      };
    }
    return {
      status: 200,
      headers: { etag: 'W/"roster-304"' },
      body: {
        date: "2026-10-24",
        summary: { totalCheckins: 0, totalCheckouts: 0, hourlyCount: 0, overnightCount: 0, dayuseCount: 0, customCount: 0 },
        checkins: [],
        checkouts: [],
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.get("/internal/v1/daily-roster", {
      staff,
      query: { date: "2026-10-24" },
      ifNoneMatch: 'W/"roster-304"',
    });

    assert.equal(res.status, 304);
    assert.equal(res.data, null);
    assert.equal(res.etag, 'W/"roster-304"');
  } finally {
    setTestFetcher(null);
  }
});

test("maps enriched roster fields, housekeepingTasks (owner_stay + urgent), 2-way ops state, >20 chunking, and VN timezone formatting", () => {
  const mapped = toDailyRosterResponse({
    date: "2026-11-19",
    summary: {
      totalCheckins: 2,
      totalCheckouts: 1,
      hourlyCount: 1,
      overnightCount: 1,
      dayuseCount: 0,
      customCount: 0,
      loyaltyPendingCount: 0,
    },
    checkins: [
      {
        ...sampleCheckinItem,
        id: "EI-CONF",
        numGuests: 3,
        remainingAmount: 220000,
        isDeposit: true,
        depositStatus: "deposit_paid",
        channel: "web",
        status: "confirmed",
      },
      {
        ...sampleCheckinItem,
        id: "EI-PEND",
        numGuests: 2,
        remainingAmount: 320000,
        status: "pending",
      },
    ],
    checkouts: [
      {
        ...sampleCheckoutItem,
        nextCheckin: {
          id: "EI-CONF",
          guestName: "Trần Thị C",
          checkinAt: "2026-11-19T04:00:00.000Z", // 11:00 VN
          numGuests: 3,
          bookingType: "hourly",
          status: "confirmed",
          note: "Chuẩn bị 3 khăn",
          closingNote: null,
          gapMinutes: 60,
        },
      },
    ],
    housekeepingTasks: [
      {
        refId: "blk_owner_1",
        kind: "owner_stay",
        roomId: "haven-101",
        roomName: "Haven 101",
        roomNumber: "101",
        roomClass: "haven",
        guestName: "Chủ nhà ở",
        bookingType: null,
        checkoutAt: "2026-11-19T03:00:00.000Z", // 10:00 VN
        turnoverStartAt: "2026-11-19T03:00:00.000Z",
        turnoverEndAt: "2026-11-19T04:00:00.000Z",
        lateCheckoutHours: 0,
        note: "Thay ga",
        closingNote: null,
        nextCheckin: {
          id: "EI-CONF",
          guestName: "Trần Thị C",
          checkinAt: "2026-11-19T04:30:00.000Z",
          numGuests: 3,
          bookingType: "hourly",
          status: "confirmed",
          note: "Thêm gối",
          closingNote: null,
          gapMinutes: 90,
        },
        urgent: true,
      },
    ],
  });

  assert.equal(mapped.checkins[0].numGuests, 3);
  assert.equal(mapped.checkins[0].remainingAmount, 220000);
  assert.equal(mapped.checkins[0].channel, "web");
  assert.equal(mapped.housekeepingTasks.length, 1);
  assert.equal(mapped.housekeepingTasks[0].kind, "owner_stay");
  assert.equal(mapped.housekeepingTasks[0].urgent, true);

  // Pending check-in without door code is NOT counted as missing confirmed code
  const withCodes = applyDoorCodes(mapped, [
    { bookingId: "EI-CONF", resolved: { missing: ["lockbox"] }, gateCode: "2580#", lockboxCode: null },
  ]);
  assert.equal(withCodes.summary.doorCodeMissingCount, 1);
  assert.deepEqual(withCodes.checkins[0].doorCodeMissing, ["lockbox"]);

  // 2-way ops state merges guide_sent and housekeeping status
  const withOps = applyOpsStates(withCodes, {
    "EI-CONF": {
      bookingId: "EI-CONF",
      checkinGuideStatus: "sent_manual",
      checkinGuideSentAt: "2026-11-19T02:00:00.000Z",
      checkinGuideSentByName: "Lễ Tân A",
      hkStatus: "pending",
      hkUpdatedAt: null,
      hkUpdatedByName: null,
    },
    blk_owner_1: {
      bookingId: "blk_owner_1",
      checkinGuideStatus: "pending",
      checkinGuideSentAt: null,
      checkinGuideSentByName: null,
      hkStatus: "done",
      hkUpdatedAt: "2026-11-19T03:45:00.000Z",
      hkUpdatedByName: "Quản Lý",
    },
  });
  assert.equal(withOps.checkins[0].checkinGuideStatus, "sent_manual");
  assert.equal(withOps.summary.guideUnsentCount, 0);
  assert.equal(withOps.summary.pendingCheckinsCount, 1);
  assert.equal(withOps.summary.hkDoneCount, 1);
  assert.equal(withOps.summary.hkUrgentCount, 0); // already done!

  // Chunking >20 stays covers 25 items cleanly (20 + 5)
  const chunks = chunkArray(Array.from({ length: 25 }, (_, i) => i), 20);
  assert.deepEqual(chunks.map((c) => c.length), [20, 5]);

  // Explicit Asia/Ho_Chi_Minh timezone formatting
  assert.equal(formatTimeShort("2026-11-19T07:30:00.000Z"), "14:30");
  assert.equal(formatDateTimeShort("2026-11-19T17:15:00.000Z"), "20/11 00:15");
});
