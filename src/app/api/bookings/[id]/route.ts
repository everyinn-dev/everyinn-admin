import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, newIdempotencyKey } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import { toLegacyBookingRow, type CoreBookingEnvelope, type CoreBookingDto } from "@/lib/coreMappers";
import { closureReasonLabel } from "@/lib/bookingClosure";
import { intentKey } from "@/lib/bffIdempotency";
import type { ClosureReasonCode } from "@/types";

const CLOSURE_CODES: readonly ClosureReasonCode[] = ["guest_cancel", "no_show", "property_cancel", "staff_error", "other"];
const REFUND_METHODS = ["cash", "bank_transfer", "card", "ewallet", "other"] as const;

const vnd = (n: number) => `${n.toLocaleString("vi-VN")} đ`;

function requireBooking(envelope: CoreBookingEnvelope | null): CoreBookingDto {
  if (!envelope?.booking) {
    throw new Error("Không nhận được dữ liệu đặt phòng từ Booking Core.");
  }
  return envelope.booking;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

/**
 * GET /api/bookings/[id] — Fetch single booking details from Booking Core.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ifNoneMatch = req.headers.get("if-none-match");

    const res = await bookingCore.get<CoreBookingEnvelope>(`/internal/v1/bookings/${id}`, {
      staff,
      ifNoneMatch,
    });

    if (res.status === 304) {
      return new Response(null, { status: 304, headers: NO_CACHE_HEADERS });
    }

    if (!res.data?.booking) {
      return Response.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    }

    const booking = toLegacyBookingRow(res.data.booking);
    const headers = new Headers(NO_CACHE_HEADERS);
    if (res.etag) headers.set("ETag", res.etag);

    return Response.json({ booking }, { headers });
  } catch (error) {
    return toHttpError(error);
  }
}

/**
 * PATCH /api/bookings/[id] — Booking state machine actions & updates via Booking Core.
 *
 * Supported actions:
 * - `cancel`: close the booking for a `reasonCode` (guest_cancel | no_show | property_cancel | staff_error | other)
 *   with an optional refund. reasonCode "no_show" → Core no-show (status no_show), the rest → Core cancel.
 * - `no_show`: alias of `cancel` with reasonCode "no_show"
 * - `complete_deposit_payment`: record a payment against the amount still due (any live booking, ≤ remaining)
 * - `mark_deposit_reminder_sent`: flag reminder timestamp
 * - `extend1h`: legacy +1h (the drawer now uses POST /api/bookings/[id]/charges)
 * - `update`: reschedule dates/room, modify guest details or custom pricing
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action;

    // Fetch latest booking projection from Booking Core for concurrency check
    const currentRes = await bookingCore.get<CoreBookingEnvelope>(`/internal/v1/bookings/${id}`, { staff });
    if (!currentRes.data?.booking) {
      return Response.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    }
    const currentBooking = currentRes.data.booking;
    const expectedVersion = Number(body.expectedVersion ?? currentBooking.control.version);

    // ── ACTION: CLOSE BOOKING (cancel, with "no_show" as one of the reasons) ──
    // `no_show` is kept as an alias of `cancel` + reasonCode "no_show" for older clients.
    if (action === "cancel" || action === "no_show") {
      const rawCode = action === "no_show" ? "no_show" : body.reasonCode;
      const reasonCode = CLOSURE_CODES.includes(rawCode as ClosureReasonCode) ? (rawCode as ClosureReasonCode) : null;
      if (!reasonCode) {
        return Response.json({ error: "Vui lòng chọn lý do huỷ.", code: "VALIDATION_FAILED", details: { field: "reasonCode" } }, { status: 400 });
      }
      const note = String(body.reason ?? body.cancelReason ?? body.noShowReason ?? "").trim();
      if (reasonCode === "other" && !note) {
        return Response.json({ error: "Vui lòng nhập lý do huỷ.", code: "REASON_REQUIRED", details: { field: "reason" } }, { status: 400 });
      }
      const rawRefund = Number(body.refundAmount ?? 0);
      const refundAmount = Number.isFinite(rawRefund) && rawRefund > 0 ? Math.round(rawRefund) : 0;
      const methodIn = String(body.refundMethod ?? body.paymentMethod ?? "cash");
      const method = (REFUND_METHODS as readonly string[]).includes(methodIn) ? methodIn : "cash";
      const reference = typeof body.refundReference === "string" && body.refundReference.trim() ? body.refundReference.trim().slice(0, 120) : undefined;
      const refund = refundAmount > 0 ? { amount: refundAmount, method, ...(reference ? { reference } : {}) } : undefined;

      const isNoShow = reasonCode === "no_show";
      const coreRes = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/${isNoShow ? "no-show" : "cancel"}`, {
        staff,
        idempotencyKey: intentKey(req, isNoShow ? "booking-noshow" : "booking-cancel"),
        body: isNoShow
          ? { expectedVersion, ...(note ? { reason: note } : {}), refund }
          : { expectedVersion, reasonCode, ...(note ? { reason: note } : {}), refund },
      });

      const closed = requireBooking(coreRes.data);
      const updated = toLegacyBookingRow(closed);
      const retained = closed.financial.netPaid ?? closed.financial.paidAmount - closed.financial.refundAmount;
      const label = isNoShow ? "Đã ghi nhận No-Show" : `Đã huỷ đặt phòng (${closureReasonLabel(reasonCode)})`;
      return Response.json({
        success: true,
        message: `${label}. ${refundAmount > 0 ? `Đã hoàn ${vnd(refundAmount)}, ` : "Không hoàn tiền, "}giữ lại ${vnd(retained)}.`,
        refundAmount,
        netRetained: retained,
        booking: updated,
      });
    }

    // ── ACTION: COMPLETE DEPOSIT PAYMENT ─────────────────────────
    if (action === "complete_deposit_payment") {
      // The drawer sends `paymentAmount` (older callers `amount`); it used to be ignored and the whole balance recorded.
      const remaining = currentBooking.financial.remainingAmount;
      const asked = Number(body.paymentAmount ?? body.amount);
      const amount = Number.isFinite(asked) && asked > 0 ? Math.round(asked) : remaining;
      if (remaining <= 0) {
        return Response.json({ error: "Đơn này không còn khoản phải thu.", code: "NOTHING_DUE" }, { status: 422 });
      }
      if (amount > remaining) {
        return Response.json(
          { error: `Số tiền thu (${vnd(amount)}) vượt quá số còn phải thu (${vnd(remaining)}).`, code: "PAYMENT_EXCEEDS_DUE", details: { remaining } },
          { status: 422 },
        );
      }
      const methodIn = String(body.paymentMethod ?? "cash");
      const method = (REFUND_METHODS as readonly string[]).includes(methodIn) ? methodIn : "cash";
      const note = (typeof body.note === "string" && body.note.trim()) || "Ghi nhận thanh toán";

      await bookingCore.post(`/internal/v1/bookings/${id}/financial-entries`, {
        staff,
        idempotencyKey: intentKey(req, "booking-deposit-pay"),
        body: {
          entryType: "payment",
          amount,
          method,
          reason: note,
        },
      });

      const refreshed = await bookingCore.get<CoreBookingEnvelope>(`/internal/v1/bookings/${id}`, { staff });
      const updated = refreshed.data?.booking ? toLegacyBookingRow(refreshed.data.booking) : null;

      return Response.json({
        success: true,
        message: "Đã ghi nhận thanh toán thành công.",
        booking: updated,
      });
    }

    // ── ACTION: MARK DEPOSIT REMINDER SENT ────────────────────────
    if (action === "mark_deposit_reminder_sent") {
      const coreRes = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/deposit-reminder`, {
        staff,
        idempotencyKey: newIdempotencyKey("booking-deposit-remind"),
        body: {
          expectedVersion,
        },
      });

      const updated = toLegacyBookingRow(requireBooking(coreRes.data));
      return Response.json({
        success: true,
        message: "Đã ghi nhận gửi nhắc nhở đặt cọc thành công.",
        booking: updated,
      });
    }

    // ── ACTION: EXTEND 1H ─────────────────────────────────────────
    if (action === "extend1h") {
      const hours = Number(body.hours) || 1;

      const coreRes = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/extend`, {
        staff,
        idempotencyKey: newIdempotencyKey("booking-extend"),
        body: {
          expectedVersion,
          hours,
        },
      });

      const updated = toLegacyBookingRow(requireBooking(coreRes.data));
      return Response.json({
        success: true,
        message: "Gia hạn thêm giờ thành công.",
        booking: updated,
      });
    }

    // ── ACTION: UPDATE BOOKING (RESCHEDULE / ROOM CHANGE / NOTES) ──
    if (action === "update") {
      const updatePayload: Record<string, unknown> = {
        expectedVersion,
      };

      if (body.roomId) updatePayload.roomId = body.roomId;
      // bookingType is locked on edit (Core: 422 BOOKING_TYPE_LOCKED) — only forwarded so Core can refuse a change.
      if (body.bookingType) updatePayload.bookingType = body.bookingType;
      if (typeof body.reason === "string" && body.reason.trim()) updatePayload.reason = body.reason.trim().slice(0, 500);
      if (body.checkinAt) updatePayload.checkinAt = body.checkinAt;
      if (body.checkoutAt) updatePayload.checkoutAt = body.checkoutAt;
      if (body.earlyCheckinHours !== undefined) updatePayload.earlyCheckinHours = Number(body.earlyCheckinHours);
      if (body.lateCheckoutHours !== undefined) updatePayload.lateCheckoutHours = Number(body.lateCheckoutHours);
      if (body.numGuests !== undefined) updatePayload.numGuests = Number(body.numGuests);
      if (body.note !== undefined) updatePayload.note = body.note || null;
      if (body.closingNote !== undefined) updatePayload.closingNote = body.closingNote || null;
      if (body.customPrice !== undefined) updatePayload.customPrice = Number(body.customPrice);
      if (body.incidentalFee !== undefined) updatePayload.incidentalFee = Number(body.incidentalFee);
      if (body.incidentalReason !== undefined) updatePayload.incidentalReason = body.incidentalReason ? String(body.incidentalReason).trim() : null;

      const coreRes = await bookingCore.patch<CoreBookingEnvelope>(`/internal/v1/bookings/${id}`, {
        staff,
        idempotencyKey: newIdempotencyKey("booking-update"),
        body: updatePayload,
      });

      const updated = toLegacyBookingRow(requireBooking(coreRes.data));
      return Response.json({
        success: true,
        message: "Cập nhật thông tin đặt phòng thành công.",
        booking: updated,
      });
    }

    // ── ACTION: RETRY LOYALTY SYNC (A-W8) ─────────────────────────
    if (action === "retry_loyalty_sync" || action === "loyalty_sync") {
      const coreRes = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/loyalty-sync`, {
        staff,
        idempotencyKey: newIdempotencyKey("booking-loyalty-sync"),
      });

      const updated = toLegacyBookingRow(requireBooking(coreRes.data));
      return Response.json({
        success: true,
        message: "Đã kích hoạt đồng bộ điểm tích lũy thành viên.",
        booking: updated,
      });
    }

    return Response.json({ error: "Hành động không hợp lệ." }, { status: 400 });
  } catch (error) {
    return toHttpError(error);
  }
}

/**
 * DELETE /api/bookings/[id] — retired. Bookings are never deleted: they are closed with
 * PATCH { action: "cancel", reasonCode, refundAmount? } so the record, the money trail and the audit stay.
 */
export async function DELETE() {
  return Response.json(
    { error: "Không thể xoá đơn đặt phòng. Vui lòng dùng chức năng \"Huỷ đặt phòng\".", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { Allow: "GET, PATCH" } },
  );
}
