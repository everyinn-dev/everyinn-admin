import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { getCachedRooms } from "@/lib/masterData";
import { GanttDataResponse, Room, Booking, RoomBlock } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // YYYY-MM-DD

    // Format current date in Vietnam UTC+7 if not provided
    const targetDate = dateParam || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

    const startOfDay = `${targetDate}T00:00:00`;
    const endOfDay = `${targetDate}T23:59:59`;

    // 1. Fetch all active rooms from cached master data
    const rooms = await getCachedRooms(db);

    // 2. Fetch all bookings that overlap with this target date
    const { results: bookings } = await db
      .prepare(
        `SELECT id, room_id, member_phone, member_name, booking_type, checkin_at, checkout_at, total_price, status, note
         FROM bookings
         WHERE status != 'cancelled'
           AND checkin_at <= ?
           AND checkout_at >= ?
         ORDER BY checkin_at ASC`
      )
      .bind(endOfDay, startOfDay)
      .all<Booking>();

    // 3. Fetch all active room blocks
    const { results: blocks } = await db
      .prepare(
        `SELECT id, room_id, blocked_from, blocked_to, reason
         FROM room_blocks
         WHERE blocked_from <= ? AND blocked_to >= ?`
      )
      .bind(endOfDay, startOfDay)
      .all<RoomBlock>();

    // 4. Map into GanttRoomData array
    const ganttRooms = (rooms || []).map((room) => {
      const roomBookings = (bookings || [])
        .filter((b) => b.room_id === room.id)
        .map((b) => ({
          id: b.id,
          roomId: b.room_id,
          guestName: b.member_name,
          phone: b.member_phone,
          bookingType: b.booking_type,
          checkinAt: b.checkin_at,
          checkoutAt: b.checkout_at,
          totalPrice: b.total_price,
          status: b.status,
          note: b.note,
        }));

      const roomBlocks = (blocks || [])
        .filter((blk) => blk.room_id === room.id)
        .map((blk) => ({
          id: blk.id,
          roomId: blk.room_id,
          blockedFrom: blk.blocked_from,
          blockedTo: blk.blocked_to,
          reason: blk.reason,
        }));

      return {
        id: room.id,
        roomNumber: room.room_number,
        name: room.name,
        roomClass: room.room_class,
        floor: room.floor,
        bookings: roomBookings,
        blocks: roomBlocks,
      };
    });

    const responseData: GanttDataResponse = {
      date: targetDate,
      rooms: ganttRooms,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("GET gantt data error:", error);
    return NextResponse.json({ error: "Failed to fetch gantt data" }, { status: 500 });
  }
}
