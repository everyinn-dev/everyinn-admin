import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { lookupMember, updateMemberSocial } from "@/lib/cdp";
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
        instagram: member.instagram,
        facebook: member.facebook,
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

export async function PATCH(
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

    const body = (await req.json()) as {
      instagram?: string;
      facebook?: string;
      fullName?: string;
    };

    const result = await updateMemberSocial(db, {
      phone,
      instagram: body.instagram,
      facebook: body.facebook,
      fullName: body.fullName,
      staffId: staff.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Cập nhật tài khoản mạng xã hội thành công",
      member: result.member,
    });
  } catch (error: any) {
    console.error("Update member social error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

