import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import { toLegacyRoom, type CoreAvailabilitySearchResponse } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const bookingType = String(body.bookingType ?? "").trim();
    const checkinAtRaw = String(body.checkinAt ?? "").trim();
    const checkoutAtRaw = String(body.checkoutAt ?? "").trim();

    if (!bookingType || !checkinAtRaw || !checkoutAtRaw) {
      return NextResponse.json(
        { error: "Vui lòng chọn loại hình đặt phòng và thời gian check-in / check-out." },
        { status: 400 }
      );
    }

    const checkin = new Date(checkinAtRaw);
    const checkout = new Date(checkoutAtRaw);
    if (Number.isNaN(checkin.getTime()) || Number.isNaN(checkout.getTime())) {
      return NextResponse.json({ error: "Thời gian check-in hoặc check-out không hợp lệ." }, { status: 400 });
    }
    if (checkout <= checkin) {
      return NextResponse.json({ error: "Thời gian check-out phải sau thời gian check-in." }, { status: 400 });
    }

    const earlyCheckinHours = Math.max(0, Math.round(Number(body.earlyCheckinHours) || 0));
    const lateCheckoutHours = Math.max(0, Math.round(Number(body.lateCheckoutHours) || 0));
    const numGuests = Math.max(1, Math.round(Number(body.numGuests) || 2));
    const roomClass = body.roomClass === "haven" || body.roomClass === "signature" ? body.roomClass : undefined;

    const res = await bookingCore.post<CoreAvailabilitySearchResponse>("/internal/v1/availability/search", {
      staff,
      body: {
        bookingType,
        checkinAt: checkin.toISOString(),
        checkoutAt: checkout.toISOString(),
        earlyCheckinHours,
        lateCheckoutHours,
        numGuests,
        ...(roomClass ? { roomClass } : {}),
      },
    });

    const data = res.data!;
    return NextResponse.json(
      {
        searchedAt: data.searchedAt,
        bookingsVersion: data.bookingsVersion,
        checkinAt: data.checkinAt,
        checkoutAt: data.checkoutAt,
        rooms: data.rooms.map((item) => ({
          room: toLegacyRoom(item.room),
          available: item.available,
          reasons: item.reasons,
          conflicts: item.conflicts,
          price: item.price,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("POST /api/availability/search error:", error);
    return coreErrorResponse(error);
  }
}

