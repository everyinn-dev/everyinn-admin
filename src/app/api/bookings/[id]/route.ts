import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, newIdempotencyKey } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import { toLegacyBookingRow, type CoreBookingEnvelope, type CoreBookingDto } from "@/lib/coreMappers";

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
 * - `no_show`: confirmed -> no_show (with optional refund)
 * - `cancel`: cancellation with inventory release and outcome recording
 * - `complete_deposit_payment`: record remaining stay payment entry
 * - `mark_deposit_reminder_sent`: flag reminder timestamp
 * - `extend1h`: extend stay by N hours (default 1)
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

    // ── ACTION: NO SHOW ───────────────────────────────────────────
    if (action === "no_show") {
      const rawRefund = Number(body.refundAmount || 0);
      const refundAmount = isNaN(rawRefund) || rawRefund < 0 ? 0 : Math.round(rawRefund);
      const reason = String(body.noShowReason || body.reason || "Khách không đến / Hủy vi phạm quy định").trim();

      const coreRes = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/no-show`, {
        staff,
        idempotencyKey: newIdempotencyKey("booking-noshow"),
        body: {
          expectedVersion,
          reason,
          refund: refundAmount > 0 ? {
            amount: refundAmount,
            method: body.paymentMethod || "cash",
          } : undefined,
        },
      });

      const updated = toLegacyBookingRow(requireBooking(coreRes.data));
      const netRetained = updated.total_price;

      return Response.json({
        success: true,
        message: refundAmount > 0
          ? `Đã đánh dấu No-Show thành công. Đã hoàn ${refundAmount.toLocaleString("vi-VN")} đ, thực thu giữ ${netRetained.toLocaleString("vi-VN")} đ.`
          : `Đã đánh dấu No-Show thành công. Khách sạn thu giữ 100% (${netRetained.toLocaleString("vi-VN")} đ).`,
        netRetained,
        refundAmount,
        booking: updated,
      });
    }

    // ── ACTION: CANCEL ────────────────────────────────────────────
    if (action === "cancel") {
      const reason = String(body.cancelReason || body.reason || "Lễ tân hủy/xóa đặt phòng").trim();

      const coreRes = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/cancel`, {
        staff,
        idempotencyKey: newIdempotencyKey("booking-cancel"),
        body: {
          expectedVersion,
          reason,
        },
      });

      const updated = toLegacyBookingRow(requireBooking(coreRes.data));
      return Response.json({
        success: true,
        message: "Đã hủy đặt phòng thành công.",
        booking: updated,
      });
    }

    // ── ACTION: COMPLETE DEPOSIT PAYMENT ─────────────────────────
    if (action === "complete_deposit_payment") {
      const amount = Number(body.amount) || currentBooking.financial.remainingAmount;
      const method = (body.paymentMethod as string) || "cash";
      const note = (body.note as string) || "Hoàn tất thanh toán cọc";

      await bookingCore.post(`/internal/v1/bookings/${id}/financial-entries`, {
        staff,
        idempotencyKey: newIdempotencyKey("booking-deposit-pay"),
        body: {
          entryType: "payment",
          amount,
          method,
          note,
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
      if (body.bookingType) updatePayload.bookingType = body.bookingType;
      if (body.checkinAt) updatePayload.checkinAt = body.checkinAt;
      if (body.checkoutAt) updatePayload.checkoutAt = body.checkoutAt;
      if (body.lateCheckoutHours !== undefined) updatePayload.lateCheckoutHours = Number(body.lateCheckoutHours);
      if (body.numGuests !== undefined) updatePayload.numGuests = Number(body.numGuests);
      if (body.note !== undefined) updatePayload.note = body.note || null;
      if (body.closingNote !== undefined) updatePayload.closingNote = body.closingNote || null;
      if (body.customPrice !== undefined) updatePayload.customPrice = Number(body.customPrice);

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
 * DELETE /api/bookings/[id] — Cancel booking (replaces legacy hard delete).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = String(body.cancelReason || body.reason || "Lễ tân hủy/xóa đặt phòng").trim();

    const currentRes = await bookingCore.get<CoreBookingEnvelope>(`/internal/v1/bookings/${id}`, { staff });
    if (!currentRes.data?.booking) {
      return Response.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    }

    const expectedVersion = Number(body.expectedVersion ?? currentRes.data.booking.control.version);

    const coreRes = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/cancel`, {
      staff,
      idempotencyKey: newIdempotencyKey("booking-delete"),
      body: {
        expectedVersion,
        reason,
      },
    });

    const updated = toLegacyBookingRow(requireBooking(coreRes.data));
    return Response.json({
      success: true,
      message: `Đã hủy đặt phòng #${id} thành công.`,
      booking: updated,
    });
  } catch (error) {
    return toHttpError(error);
  }
}
