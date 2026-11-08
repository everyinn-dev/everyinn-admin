import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import { clientIdemKey, sessionIdForHold, sessions } from "@/lib/sessions";
import { toLegacyBookingRow, type CoreBookingEnvelope } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;


interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/holds/[id]/confirm-payment
 * Converts the 15-minute hold into an authoritative confirmed booking in Booking Core,
 * then sends a Telegram notification to the Owner.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const holdId = String(id ?? "").trim();
    if (!holdId) {
      return NextResponse.json({ error: "Thiếu mã phiên giữ phòng." }, { status: 400 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const paymentMethod = String(body.paymentMethod ?? "bank_transfer").trim() || "bank_transfer";

    // LSB-5: money received by this receptionist → booking-session engine (records the payment with its method,
    // confirms in Booking Core with THIS staff actor, door-code reminder + compact Telegram card by agent-core).
    const idempotencyKey = clientIdemKey(req);
    const sessionId = await sessionIdForHold(staff, holdId);
    const amount = body.amount !== undefined ? Math.round(Number(body.amount) || 0) : undefined;
    // already confirmed elsewhere (guest paid through the shared link + ✅ on Telegram / another tab) → just read it
    const current = (await sessions.get(staff, sessionId)).data!.session;
    const s =
      current.bookingId && !amount
        ? current
        : (await sessions.action(staff, sessionId, amount ? "payments" : "confirm", amount ? { amount, method: paymentMethod } : { method: paymentMethod }, idempotencyKey)).data!.session;
    if (!s.bookingId) {
      return NextResponse.json({ success: false, session: s, error: s.status === "underpaid" ? `Đã ghi nhận ${s.paidAmount.toLocaleString("vi-VN")}đ — còn thiếu ${s.remaining.toLocaleString("vi-VN")}đ.` : "Chưa xác nhận được đơn." }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }
    const res = await bookingCore.get<CoreBookingEnvelope>(`/internal/v1/bookings/${encodeURIComponent(s.bookingId)}`, { staff });
    const coreBooking = res.data!.booking;
    const replayed = false;
    const row = toLegacyBookingRow(coreBooking);
    const loyalty = coreBooking.loyalty;

    // Telegram: agent-core's session engine posts the (compact) card for admin bookings — no second message here.
    const telegramResult = { sent: true, reason: "SESSION_ENGINE" };

    return NextResponse.json(
      {
        success: true,
        replayed,
        telegramSent: telegramResult.sent,
        telegramReason: telegramResult.reason ?? null,
        booking: {
          id: row.id,
          roomId: row.room_id,
          roomName: row.room_name,
          roomClass: row.room_class,
          phone: row.member_phone,
          name: row.member_name,
          instagram: row.instagram ?? "",
          facebook: row.facebook ?? "",
          zalo: row.zalo ?? "",
          closingNote: row.closing_note ?? "",
          bookingType: row.booking_type,
          checkinAt: row.checkin_at,
          checkoutAt: row.checkout_at,
          totalPrice: row.total_price,
          status: row.status,
          isDeposit: row.is_deposit,
          depositAmount: row.deposit_amount,
          paidAmount: row.paid_amount,
          remainingAmount: row.remaining_amount,
          depositDueDate: row.deposit_due_date,
          depositStatus: row.deposit_status,
          version: row.mod_no,
        },
        loyalty: { syncStatus: loyalty.syncStatus, tier: loyalty.tier },
      },
      { status: res.status === 201 ? 201 : 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("POST /api/holds/[id]/confirm-payment error:", error);
    return coreErrorResponse(error);
  }
}
