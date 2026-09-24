import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { Booking } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await db
      .prepare(
        `SELECT b.*, r.name as room_name, r.room_class, s.full_name as created_by_staff_name
         FROM bookings b
         LEFT JOIN rooms r ON b.room_id = r.id
         LEFT JOIN staff s ON b.created_by_staff_id = s.id
         WHERE b.id = ?
         LIMIT 1`
      )
      .bind(id)
      .first<Booking>();

    if (!booking) {
      return NextResponse.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    }

    return NextResponse.json({ booking });
  } catch (error) {
    console.error("GET booking by ID error:", error);
    return NextResponse.json({ error: "Lỗi tải thông tin đặt phòng." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json()) as any;
    const { action, cancelReason } = body;

    const existing = await db
      .prepare("SELECT * FROM bookings WHERE id = ? LIMIT 1")
      .bind(id)
      .first<Booking>();

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    }

    if (action === "cancel") {
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE bookings SET
            status = 'cancelled',
            cancelled_at = ?,
            cancel_reason = ?,
            cancelled_by = ?,
            updated_at = ?
           WHERE id = ?`
        )
        .bind(now, cancelReason || "Lễ tân hủy", staff.id, now, id)
        .run();

      await logEvent(
        db,
        "BOOKING_CANCELLED",
        "booking",
        id,
        { cancelReason, cancelledByStaffId: staff.id },
        staff.id
      );

      return NextResponse.json({ success: true, message: "Đã hủy đặt phòng thành công." });
    }

    return NextResponse.json({ error: "Hành động không hợp lệ." }, { status: 400 });
  } catch (error) {
    console.error("PATCH booking error:", error);
    return NextResponse.json({ error: "Lỗi cập nhật đặt phòng." }, { status: 500 });
  }
}
