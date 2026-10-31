import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse, newIdempotencyKey } from "@/lib/cores";
import { toLegacyBookingRow, type CoreBookingEnvelope } from "@/lib/coreMappers";
import { sendTelegramBookingNotification, type TelegramSendResult } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

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
    const paymentReference = body.paymentReference ? String(body.paymentReference).trim() : undefined;

    const headerKey = req.headers.get("idempotency-key")?.trim();
    const idempotencyKey =
      headerKey && IDEMPOTENCY_KEY_RE.test(headerKey) ? headerKey : newIdempotencyKey("hold-confirm");

    const res = await bookingCore.post<CoreBookingEnvelope>(
      `/internal/v1/holds/${encodeURIComponent(holdId)}/confirm`,
      {
        staff,
        idempotencyKey,
        body: {
          paymentMethod,
          ...(paymentReference ? { paymentReference } : {}),
        },
      }
    );

    const coreBooking = res.data!.booking;
    const replayed = res.data!.replayed ?? false;
    const row = toLegacyBookingRow(coreBooking);
    const loyalty = coreBooking.loyalty;

    // Send Telegram notification to Owner on fresh booking confirmation (not on idempotent replays)
    let telegramResult: TelegramSendResult = { sent: false, reason: "REPLAYED" };
    if (!replayed) {
      telegramResult = await sendTelegramBookingNotification(coreBooking, staff, { holdId });
    }

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
