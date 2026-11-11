import test from "node:test";
import assert from "node:assert/strict";
import {
  CLOSURE_REASONS,
  bookingRowToItem,
  canCloseBooking,
  closureReasonLabel,
  isClosedBooking,
  isVersionConflict,
  netReceivedOf,
} from "../src/lib/bookingClosure.ts";
import { toLegacyBookingRow } from "../src/lib/coreMappers.ts";

const NOW = Date.parse("2026-11-11T05:00:00.000Z");

test("unified cancel flow: every reason code is offered once; refund defaults follow policy", () => {
  assert.deepEqual(
    CLOSURE_REASONS.map((r) => r.code),
    ["guest_cancel", "no_show", "property_cancel", "staff_error", "other"],
  );
  const byCode = Object.fromEntries(CLOSURE_REASONS.map((r) => [r.code, r]));
  assert.equal(byCode.guest_cancel.defaultRefund, "none"); // "không hoàn cọc khi khách tự huỷ"
  assert.equal(byCode.property_cancel.defaultRefund, "full");
  assert.equal(byCode.staff_error.defaultRefund, "full");
  assert.equal(byCode.other.noteRequired, true);
  assert.equal(closureReasonLabel("no_show"), "Khách không đến (No-show)");
  assert.equal(closureReasonLabel(null), null);
});

test("canCloseBooking: only live bookings before checkout; closed bookings are read-only", () => {
  const future = "2026-11-11T08:00:00.000Z";
  const past = "2026-11-11T04:00:00.000Z";
  assert.equal(canCloseBooking({ status: "confirmed", checkoutAt: future }, NOW), true);
  assert.equal(canCloseBooking({ status: "pending", checkoutAt: future }, NOW), true);
  assert.equal(canCloseBooking({ status: "confirmed", checkoutAt: past }, NOW), false);
  assert.equal(canCloseBooking({ status: "cancelled", checkoutAt: future }, NOW), false);
  assert.equal(canCloseBooking({ status: "no_show", checkoutAt: future }, NOW), false);
  assert.equal(isClosedBooking({ status: "cancelled" }), true);
  assert.equal(isClosedBooking({ status: "confirmed" }), false);
});

test("netReceivedOf uses the ledger projection, never totalPrice", () => {
  assert.equal(netReceivedOf({ netPaid: 70000, paidAmount: 100000, refundAmount: 30000 }), 70000);
  assert.equal(netReceivedOf({ paidAmount: 100000, refundAmount: 30000 }), 70000);
  assert.equal(netReceivedOf({}), 0); // unpaid walk-in: nothing received, nothing to refund
});

test("isVersionConflict: only VERSION_CONFLICT is a concurrent edit; INVALID_STATE shows Core's reason", () => {
  assert.equal(isVersionConflict(409, { code: "VERSION_CONFLICT" }), true);
  assert.equal(isVersionConflict(409, { code: "INVALID_STATE", error: "Đơn đặt phòng đã ở trạng thái hủy hoặc No-Show." }), false);
  assert.equal(isVersionConflict(409, { code: "PAST_CHECKOUT" }), false);
  assert.equal(isVersionConflict(422, { code: "VERSION_CONFLICT" }), false);
});

test("closure fields flow Core DTO → legacy row → drawer item", () => {
  const dto = {
    id: "bk-closed-1",
    propertyId: "p",
    roomId: "haven-101",
    roomName: "101",
    roomClass: "haven",
    numGuests: 2,
    bookingType: "hourly",
    checkinAt: "2026-11-11T03:00:00.000Z",
    checkoutAt: "2026-11-11T06:00:00.000Z",
    earlyCheckinHours: 0,
    lateCheckoutHours: 0,
    status: "cancelled",
    note: null,
    closingNote: "ok",
    guest: { phoneDisplay: "0901234567", contactRaw: "0901234567", name: "A", instagram: null, facebook: null, zalo: null },
    pricing: { basePrice: 320000, holidaySurcharge: 0, extraGuestFee: 0, extraFee: 0, discountAmount: 0, totalPrice: 320000, originalPrice: 320000 },
    promotion: null,
    loyalty: { syncStatus: "not_applicable", step: null, tier: null, syncedAt: null },
    financial: {
      isDeposit: true, depositAmount: 200000, paidAmount: 200000, refundAmount: 150000, netPaid: 50000, remainingAmount: 0,
      depositStatus: "deposit_paid", depositDueDate: null, depositPaidAt: null, depositReminderSentAt: null, depositReminderSentBy: null,
      remainingPaidAt: null, remainingPaidBy: null,
    },
    lifecycle: {
      confirmedAt: null,
      cancelledAt: "2026-11-11T02:00:00.000Z",
      cancelledBy: { id: 7, name: "Lễ Tân B" },
      cancelReason: "Máy lạnh hỏng",
      closureReasonCode: "property_cancel",
      noShowAt: null, noShowBy: null, noShowReason: null,
    },
    control: { version: 3, createdAt: "2026-11-10T00:00:00.000Z", createdBy: null, updatedAt: "2026-11-11T02:00:00.000Z", updatedBy: null },
  };
  const row = toLegacyBookingRow(dto);
  assert.equal(row.closure_reason_code, "property_cancel");
  assert.equal(row.cancelled_by_staff_name, "Lễ Tân B");
  assert.equal(row.net_paid, 50000);

  const item = bookingRowToItem(row);
  assert.equal(item.status, "cancelled");
  assert.equal(item.closureReasonCode, "property_cancel");
  assert.equal(item.cancelReason, "Máy lạnh hỏng");
  assert.equal(item.cancelledByStaffName, "Lễ Tân B");
  assert.equal(item.paidAmount, 200000);
  assert.equal(item.refundAmount, 150000);
  assert.equal(netReceivedOf(item), 50000);
  assert.equal(item.version, 3);
});
