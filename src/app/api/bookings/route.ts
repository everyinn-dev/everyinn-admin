import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { generateBookingId } from "@/lib/bookingId";
import { calculatePrice } from "@/lib/pricing";
import { upsertMemberOnBooking } from "@/lib/cdp";
import { logEvent } from "@/lib/audit";
import { BookingType, PricingRule, Room } from "@/types";
import { getCachedRooms, getCachedPricingRules } from "@/lib/masterData";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // YYYY-MM-DD
    const roomId = searchParams.get("roomId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    let query = `
      SELECT b.*, r.name as room_name, r.room_class
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (roomId) {
      query += ` AND b.room_id = ?`;
      params.push(roomId);
    }

    if (status) {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    if (date) {
      // Find bookings overlapping with this date
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      query += ` AND b.checkin_at <= ? AND b.checkout_at >= ?`;
      params.push(endOfDay, startOfDay);
    }

    query += ` ORDER BY b.checkin_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = db.prepare(query);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const { results } = await bound.all();

    return NextResponse.json({ bookings: results });
  } catch (error) {
    console.error("GET bookings error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const {
      roomId,
      phone,
      name,
      numGuests = 2,
      bookingType,
      checkinAt,
      checkoutAt,
      lateCheckoutHours = 0,
      note = "",
      status = "confirmed",
    } = body;

    // Basic validation
    if (!roomId || !phone || !name || !bookingType || !checkinAt || !checkoutAt) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ các thông tin bắt buộc." },
        { status: 400 }
      );
    }

    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const checkinDate = new Date(checkinAt);
    const checkoutDate = new Date(checkoutAt);

    if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
      return NextResponse.json(
        { error: "Thời gian check-in hoặc check-out không hợp lệ." },
        { status: 400 }
      );
    }

    if (checkoutDate <= checkinDate) {
      return NextResponse.json(
        { error: "Thời gian check-out phải sau thời gian check-in." },
        { status: 400 }
      );
    }

    // 1. Fetch Room details from cached master data
    const rooms = await getCachedRooms(db);
    const room = rooms.find((r) => r.id === roomId && r.is_active === 1);

    if (!room) {
      return NextResponse.json({ error: "Phòng không tồn tại hoặc đã ngừng hoạt động." }, { status: 404 });
    }

    // 2. Overlap collision check
    const checkinIso = checkinDate.toISOString();
    const checkoutIso = checkoutDate.toISOString();

    const overlap = await db
      .prepare(
        `SELECT id, checkin_at, checkout_at, status
         FROM bookings
         WHERE room_id = ?
           AND status != 'cancelled'
           AND checkin_at < ?
           AND checkout_at > ?
         LIMIT 1`
      )
      .bind(roomId, checkoutIso, checkinIso)
      .first<{ id: string; checkin_at: string; checkout_at: string; status: string }>();

    if (overlap) {
      return NextResponse.json(
        {
          error: `Phòng ${room.name} đã có lịch đặt (#${overlap.id}) từ ${new Date(
            overlap.checkin_at
          ).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} đến ${new Date(
            overlap.checkout_at
          ).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`,
        },
        { status: 409 }
      );
    }

    // 3. Fetch Pricing Rules from cached master data
    const pricingRules = await getCachedPricingRules(db);

    // 4. Calculate locked price snapshot
    const pricing = calculatePrice({
      bookingType: bookingType as BookingType,
      roomClass: room.room_class,
      checkinAt: checkinDate,
      checkoutAt: checkoutDate,
      lateCheckoutHours: Number(lateCheckoutHours) || 0,
      pricingRules,
    });

    const bookingId = generateBookingId();
    const nowIso = new Date().toISOString();

    // 5. Insert Booking
    await db
      .prepare(
        `INSERT INTO bookings (
          id, property_id, room_id, member_phone, member_name, num_guests,
          booking_type, checkin_at, checkout_at, late_checkout_hours, note,
          created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )`
      )
      .bind(
        bookingId,
        room.property_id,
        room.id,
        cleanPhone,
        cleanName,
        Number(numGuests) || 2,
        bookingType,
        checkinIso,
        checkoutIso,
        Number(lateCheckoutHours) || 0,
        note,
        staff.id,
        status,
        pricing.basePrice,
        pricing.totalExtraFee,
        pricing.discountAmount,
        pricing.totalPrice,
        nowIso,
        nowIso
      )
      .run();

    // 6. CDP: Upsert member and recalculate loyalty tier
    const cdpResult = await upsertMemberOnBooking(db, {
      phone: cleanPhone,
      name: cleanName,
      totalPrice: pricing.totalPrice,
      bookingType: bookingType as BookingType,
      roomClass: room.room_class,
      staffId: staff.id,
    });

    // 7. Audit Log
    await logEvent(
      db,
      "BOOKING_CREATED",
      "booking",
      bookingId,
      {
        bookingId,
        roomId: room.id,
        roomName: room.name,
        phone: cleanPhone,
        name: cleanName,
        totalPrice: pricing.totalPrice,
        bookingType,
      },
      staff.id
    );

    return NextResponse.json({
      success: true,
      booking: {
        id: bookingId,
        roomId: room.id,
        roomName: room.name,
        roomClass: room.room_class,
        phone: cleanPhone,
        name: cleanName,
        bookingType,
        checkinAt: checkinIso,
        checkoutAt: checkoutIso,
        totalPrice: pricing.totalPrice,
        status,
      },
      cdp: cdpResult,
    });
  } catch (error: any) {
    console.error("POST booking error:", error);
    return NextResponse.json(
      { error: error?.message || "Đã xảy ra lỗi khi tạo đặt phòng." },
      { status: 500 }
    );
  }
}
