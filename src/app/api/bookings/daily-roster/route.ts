import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { getCachedRooms } from "@/lib/masterData";
import { getVnToday } from "@/lib/timelineUtils";
import { DailyRosterItem, DailyRosterResponse, DailyRosterSummary } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date")?.trim() || getVnToday();

    // Validate YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "Định dạng ngày không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD." },
        { status: 400 }
      );
    }

    // Convert Vietnam target date (UTC+7) to exact UTC ISO boundaries
    const startOfDayUtc = new Date(`${dateParam}T00:00:00+07:00`).toISOString();
    const endOfDayUtc = new Date(`${dateParam}T23:59:59.999+07:00`).toISOString();

    // 1. Fetch Rooms from module in-memory cache (0 extra D1 query)
    const rooms = await getCachedRooms(db);
    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    // 2. Query Check-ins & Check-outs in a single db.batch() round-trip (D1 Quota Protection)
    const [checkinsBatch, checkoutsBatch] = await db.batch([
      // Check-ins for this date
      db
        .prepare(
          `SELECT 
            b.id, b.room_id, b.member_phone, b.member_name, b.instagram, b.facebook,
            b.num_guests, b.booking_type, b.checkin_at, b.checkout_at, b.late_checkout_hours,
            b.note, b.closing_note, b.status, b.base_price, b.extra_fee, b.discount_amount,
            b.total_price, b.door_code, b.door_code_sent_at, b.created_at, b.created_by_staff_id,
            b.updated_at, b.updated_by_staff_id, b.mod_no,
            s_cr.full_name AS created_by_staff_name,
            s_up.full_name AS updated_by_staff_name,
            m.loyalty_tier, m.total_bookings
          FROM bookings b
          LEFT JOIN staff s_cr ON s_cr.id = b.created_by_staff_id
          LEFT JOIN staff s_up ON s_up.id = b.updated_by_staff_id
          LEFT JOIN members m ON m.phone = b.member_phone
          WHERE b.status != 'cancelled'
            AND b.checkin_at >= ?
            AND b.checkin_at <= ?
          ORDER BY b.checkin_at ASC`
        )
        .bind(startOfDayUtc, endOfDayUtc),

      // Check-outs for this date
      db
        .prepare(
          `SELECT 
            b.id, b.room_id, b.member_phone, b.member_name, b.instagram, b.facebook,
            b.num_guests, b.booking_type, b.checkin_at, b.checkout_at, b.late_checkout_hours,
            b.note, b.closing_note, b.status, b.base_price, b.extra_fee, b.discount_amount,
            b.total_price, b.door_code, b.door_code_sent_at, b.created_at, b.created_by_staff_id,
            b.updated_at, b.updated_by_staff_id, b.mod_no,
            s_cr.full_name AS created_by_staff_name,
            s_up.full_name AS updated_by_staff_name,
            m.loyalty_tier, m.total_bookings
          FROM bookings b
          LEFT JOIN staff s_cr ON s_cr.id = b.created_by_staff_id
          LEFT JOIN staff s_up ON s_up.id = b.updated_by_staff_id
          LEFT JOIN members m ON m.phone = b.member_phone
          WHERE b.status != 'cancelled'
            AND b.checkout_at >= ?
            AND b.checkout_at <= ?
          ORDER BY b.checkout_at ASC`
        )
        .bind(startOfDayUtc, endOfDayUtc),
    ]);

    const rawCheckins = (checkinsBatch?.results || []) as any[];
    const rawCheckouts = (checkoutsBatch?.results || []) as any[];

    // Transform to typed DailyRosterItem with Room & Turnover info
    const mapToRosterItem = (row: any): DailyRosterItem => {
      const room = roomMap.get(row.room_id);
      const checkoutDate = new Date(row.checkout_at);
      const turnoverEnd = new Date(checkoutDate.getTime() + 60 * 60 * 1000).toISOString();

      return {
        id: row.id,
        roomId: row.room_id,
        roomName: room?.name || row.room_id,
        roomNumber: room?.room_number || "",
        roomClass: room?.room_class || "haven",
        floor: room?.floor || 1,
        guestName: row.member_name || "",
        phone: row.member_phone || "",
        instagram: row.instagram || undefined,
        facebook: row.facebook || undefined,
        bookingType: row.booking_type,
        checkinAt: row.checkin_at,
        checkoutAt: row.checkout_at,
        turnoverStartAt: row.checkout_at,
        turnoverEndAt: turnoverEnd,
        totalPrice: Number(row.total_price) || 0,
        status: row.status,
        doorCode: row.door_code || undefined,
        doorCodeSentAt: row.door_code_sent_at || undefined,
        closingNote: row.closing_note || undefined,
        note: row.note || undefined,
        loyaltyTier: row.loyalty_tier || "new",
        totalBookings: row.total_bookings || 0,
        lateCheckoutHours: row.late_checkout_hours || 0,
        createdAt: row.created_at,
        createdByStaffId: row.created_by_staff_id,
        createdByStaffName: row.created_by_staff_name,
        updatedAt: row.updated_at,
        updatedByStaffId: row.updated_by_staff_id,
        updatedByStaffName: row.updated_by_staff_name,
        modNo: row.mod_no || 0,
      };
    };

    const checkins = rawCheckins.map(mapToRosterItem);
    const checkouts = rawCheckouts.map(mapToRosterItem);

    // Summary calculation for quick operational glance
    let hourlyCount = 0;
    let overnightCount = 0;
    let dayuseCount = 0;
    let customCount = 0;
    let doorCodeMissingCount = 0;

    checkins.forEach((c) => {
      if (c.bookingType === "hourly") hourlyCount++;
      else if (c.bookingType === "overnight") overnightCount++;
      else if (c.bookingType === "dayuse") dayuseCount++;
      else if (c.bookingType === "custom") customCount++;

      if (!c.doorCode) {
        doorCodeMissingCount++;
      }
    });

    const summary: DailyRosterSummary = {
      totalCheckins: checkins.length,
      totalCheckouts: checkouts.length,
      hourlyCount,
      overnightCount,
      dayuseCount,
      customCount,
      doorCodeMissingCount,
    };

    const response: DailyRosterResponse = {
      date: dateParam,
      summary,
      checkins,
      checkouts,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Daily roster API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy lịch vận hành ngày." },
      { status: 500 }
    );
  }
}
