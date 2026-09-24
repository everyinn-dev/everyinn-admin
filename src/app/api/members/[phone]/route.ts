import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { lookupMember } from "@/lib/cdp";
import { getCurrentStaff } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { phone } = await params;
    if (!phone) {
      return NextResponse.json({ error: "Missing phone parameter" }, { status: 400 });
    }

    const member = await lookupMember(db, phone);
    if (!member) {
      return NextResponse.json({ found: false, member: null });
    }

    return NextResponse.json({
      found: true,
      member: {
        phone: member.phone,
        fullName: member.full_name,
        totalBookings: member.total_bookings,
        totalSpent: member.total_spent,
        totalNights: member.total_nights,
        loyaltyTier: member.loyalty_tier,
        preferredRoomClass: member.preferred_room_class,
        lastBookedAt: member.last_booked_at,
        isBlocked: member.is_blocked,
        internalNotes: member.internal_notes,
      },
    });
  } catch (error) {
    console.error("CDP Member lookup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
