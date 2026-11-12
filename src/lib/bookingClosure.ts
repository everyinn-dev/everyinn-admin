/**
 * Unified cancel flow (ADMIN_BUSINESS_FLOW_REVIEW_2026-11-11 §2).
 *
 * One staff action — "Huỷ đặt phòng" — closes a booking for a reason. "Khách không đến" is one of those reasons:
 * the BFF routes it to Booking Core's no-show command (status `no_show`), every other reason to cancel (status
 * `cancelled`). Every closure goes through the same money step: refund 0…net received, the rest is retained.
 */
import type { Booking, ClosureReasonCode, GanttBookingItem } from "@/types";

export interface ClosureReasonOption {
  code: ClosureReasonCode;
  label: string;
  hint: string;
  /** Refund pre-selected when this reason is chosen (staff can change it). */
  defaultRefund: "none" | "full";
  /** Free-text note is mandatory. */
  noteRequired: boolean;
}

export const CLOSURE_REASONS: readonly ClosureReasonOption[] = [
  { code: "guest_cancel", label: "Khách chủ động huỷ", hint: "Chính sách: không hoàn tiền cọc khi khách tự huỷ.", defaultRefund: "none", noteRequired: false },
  { code: "no_show", label: "Khách không đến (No-show)", hint: "Ghi nhận No-show; chỉ áp dụng cho đơn đã xác nhận.", defaultRefund: "none", noteRequired: false },
  { code: "property_cancel", label: "Khách sạn huỷ (sự cố phòng / overbook)", hint: "Lỗi phía khách sạn: mặc định hoàn toàn bộ.", defaultRefund: "full", noteRequired: false },
  { code: "staff_error", label: "Tạo nhầm / đổi hình thức (tạo lại đơn)", hint: "Đặt nhầm hoặc cần đổi hình thức: huỷ, hoàn toàn bộ số đã thu rồi tạo đơn mới cho khách.", defaultRefund: "full", noteRequired: false },
  { code: "other", label: "Lý do khác", hint: "Bắt buộc ghi rõ lý do.", defaultRefund: "none", noteRequired: true },
];

export function closureReasonLabel(code: ClosureReasonCode | null | undefined): string | null {
  return CLOSURE_REASONS.find((r) => r.code === code)?.label ?? null;
}

export const REFUND_METHODS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "bank_transfer", label: "Chuyển khoản" },
  { value: "card", label: "Thẻ" },
  { value: "ewallet", label: "Ví điện tử" },
  { value: "other", label: "Khác" },
] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number]["value"];

/** A live booking that has not reached checkout can be closed. */
export function canCloseBooking(b: Pick<GanttBookingItem, "status" | "checkoutAt">, now = Date.now()): boolean {
  return (b.status === "pending" || b.status === "confirmed") && now <= Date.parse(b.checkoutAt);
}

export function isClosedBooking(b: Pick<GanttBookingItem, "status">): boolean {
  return b.status === "cancelled" || b.status === "no_show";
}

/** Money actually kept: received − refunded, from the ledger projection (never `totalPrice`). */
export function netReceivedOf(b: Pick<GanttBookingItem, "netPaid" | "paidAmount" | "refundAmount">): number {
  if (typeof b.netPaid === "number") return b.netPaid;
  return Math.max(0, (b.paidAmount ?? 0) - (b.refundAmount ?? 0));
}

/** Legacy BFF row (snake_case) → drawer item (camelCase). Single mapper for the list and the drawer refetch. */
export function bookingRowToItem(b: Booking): GanttBookingItem {
  return {
    id: b.id,
    roomId: b.room_id,
    guestName: b.member_name,
    phone: b.member_phone,
    bookingType: b.booking_type,
    checkinAt: b.checkin_at,
    checkoutAt: b.checkout_at,
    earlyCheckinHours: b.early_checkin_hours,
    lateCheckoutHours: b.late_checkout_hours,
    numGuests: b.num_guests,
    basePrice: b.base_price,
    holidaySurcharge: b.holiday_surcharge,
    extraGuestFee: b.extra_guest_fee,
    extraFee: b.extra_fee,
    incidentalFee: b.incidental_fee,
    incidentalReason: b.incidental_reason,
    discountAmount: b.discount_amount,
    promotionName: b.promotion_name,
    totalPrice: b.total_price,
    status: b.status,
    instagram: b.instagram,
    facebook: b.facebook,
    zalo: b.zalo,
    closingNote: b.closing_note,
    note: b.note,
    // Control fields
    createdAt: b.created_at,
    createdByStaffId: b.created_by_staff_id,
    createdByStaffName: b.created_by_staff_name,
    updatedAt: b.updated_at,
    updatedByStaffId: b.updated_by_staff_id,
    updatedByStaffName: b.updated_by_staff_name,
    modNo: b.mod_no,
    version: b.version ?? b.mod_no,
    loyaltySyncStatus: b.loyalty_sync_status,
    // Closure (cancel / no-show)
    cancelledAt: b.cancelled_at,
    cancelledByStaffName: b.cancelled_by_staff_name ?? null,
    cancelReason: b.cancel_reason,
    closureReasonCode: b.closure_reason_code ?? null,
    charges: b.charges ?? [],
    noShowAt: b.no_show_at,
    noShowBy: b.no_show_by,
    noShowByStaffName: b.no_show_by_staff_name,
    noShowReason: b.no_show_reason,
    refundAmount: b.refund_amount,
    originalPrice: b.original_price,
    netPaid: b.net_paid,
    // Deposit / payment
    isDeposit: b.is_deposit,
    depositAmount: b.deposit_amount,
    paidAmount: b.paid_amount,
    remainingAmount: b.remaining_amount,
    depositDueDate: b.deposit_due_date,
    depositStatus: b.deposit_status,
    depositPaidAt: b.deposit_paid_at,
    depositReminderSentAt: b.deposit_reminder_sent_at,
    remainingPaidAt: b.remaining_paid_at,
  };
}

/** Error shape of the BFF (`toHttpError`): Vietnamese message + Core error code. */
export interface BffError {
  error?: string;
  code?: string;
}

/** Only a real optimistic-lock failure is a "someone else changed it"; every other 409 carries Core's own reason. */
export function isVersionConflict(status: number, data: BffError | null | undefined): boolean {
  return status === 409 && data?.code === "VERSION_CONFLICT";
}
