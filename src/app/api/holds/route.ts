import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse, newIdempotencyKey } from "@/lib/cores";
import type { CoreHoldEnvelope } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * POST /api/holds — Create a 15-minute room hold locking occupancy & turnover slots.
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const roomId = String(body.roomId ?? "").trim();
    const bookingType = String(body.bookingType ?? "").trim();
    const checkinAtRaw = String(body.checkinAt ?? "").trim();
    const checkoutAtRaw = String(body.checkoutAt ?? "").trim();

    if (!roomId || !bookingType || !checkinAtRaw || !checkoutAtRaw) {
      return NextResponse.json({ error: "Thiếu thông tin phòng hoặc thời gian lưu trú để giữ phòng." }, { status: 400 });
    }

    const checkin = new Date(checkinAtRaw);
    const checkout = new Date(checkoutAtRaw);
    if (Number.isNaN(checkin.getTime()) || Number.isNaN(checkout.getTime()) || checkout <= checkin) {
      return NextResponse.json({ error: "Thời gian check-in / check-out không hợp lệ." }, { status: 400 });
    }

    const earlyCheckinHours = Math.max(0, Math.round(Number(body.earlyCheckinHours) || 0));
    const lateCheckoutHours = Math.max(0, Math.round(Number(body.lateCheckoutHours) || 0));
    const numGuests = Math.max(1, Math.round(Number(body.numGuests) || 2));

    const headerKey = req.headers.get("idempotency-key")?.trim();
    const idempotencyKey = headerKey && IDEMPOTENCY_KEY_RE.test(headerKey) ? headerKey : newIdempotencyKey("hold-create");

    const res = await bookingCore.post<CoreHoldEnvelope>("/internal/v1/holds", {
      staff,
      idempotencyKey,
      body: {
        roomId,
        bookingType,
        checkinAt: checkin.toISOString(),
        checkoutAt: checkout.toISOString(),
        earlyCheckinHours,
        lateCheckoutHours,
        numGuests,
      },
    });

    return NextResponse.json(
      {
        success: true,
        replayed: res.data?.replayed ?? false,
        hold: res.data!.hold,
      },
      { status: res.status === 201 ? 201 : 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("POST /api/holds error:", error);
    return coreErrorResponse(error);
  }
}

