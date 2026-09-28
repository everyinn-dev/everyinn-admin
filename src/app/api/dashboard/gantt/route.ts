import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { getCachedRooms } from "@/lib/masterData";
import { GanttDataResponse, Booking, RoomBlock } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // YYYY-MM
    const dateParam = searchParams.get("date"); // YYYY-MM-DD

    // 1. Lightweight Event-Version Check (Consumes only 1 D1 Row Read)
    const eventRow = await db
      .prepare("SELECT COALESCE(MAX(id), 0) as last_event_id FROM event_logs")
      .first<{ last_event_id: number }>();
    const lastEventId = eventRow?.last_event_id || 0;

    const targetKey = monthParam ? `m-${monthParam}` : `d-${dateParam || "today"}`;
    const etag = `W/"ev-${lastEventId}-${targetKey}"`;

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "no-cache",
        },
      });
    }

    // Fetch all active rooms from cached master data
    const rooms = await getCachedRooms(db);

    // MODE 1: MONTH VIEW (Whole month timeline, queried live from D1)
    if (monthParam) {
      const parts = monthParam.split("-");
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const daysInMonth = new Date(year, month, 0).getDate();

      const startOfMonth = `${monthParam}-01T00:00:00`;
      const endOfMonth = `${monthParam}-${String(daysInMonth).padStart(2, "0")}T23:59:59`;

      // Live batch query on Cloudflare D1 (stateless across all workers)
      const [bookingsBatch, blocksBatch] = await db.batch([
        db
          .prepare(
            `SELECT id, room_id, member_phone, member_name, instagram, facebook, closing_note, booking_type, checkin_at, checkout_at, total_price, status, note
             FROM bookings
             WHERE status NOT IN ('cancelled', 'no_show')
               AND checkin_at <= ?
               AND checkout_at >= ?
             ORDER BY checkin_at ASC`
          )
          .bind(endOfMonth, startOfMonth),
        db
          .prepare(
            `SELECT id, room_id, blocked_from, blocked_to, reason, note, created_by, created_at
             FROM room_blocks
             WHERE blocked_from <= ? AND blocked_to >= ?
             ORDER BY blocked_from ASC`
          )
          .bind(endOfMonth, startOfMonth),
      ]);

      const bookings = (bookingsBatch?.results || []) as Booking[];
      const blocks = (blocksBatch?.results || []) as RoomBlock[];

      const ganttRooms = (rooms || []).map((room) => {
        const roomBookings = (bookings || [])
          .filter((b) => b.room_id === room.id)
          .map((b) => ({
            id: b.id,
            roomId: b.room_id,
            guestName: b.member_name,
            phone: b.member_phone,
            instagram: b.instagram,
            facebook: b.facebook,
            closingNote: b.closing_note,
            bookingType: b.booking_type,
            checkinAt: b.checkin_at,
            checkoutAt: b.checkout_at,
            totalPrice: b.total_price,
            status: b.status,
            note: b.note,
            isDeposit: b.is_deposit,
            depositAmount: b.deposit_amount,
            paidAmount: b.paid_amount,
            remainingAmount: b.remaining_amount,
            depositDueDate: b.deposit_due_date,
            depositStatus: b.deposit_status,
            depositPaidAt: b.deposit_paid_at,
            depositReminderSentAt: b.deposit_reminder_sent_at,
            remainingPaidAt: b.remaining_paid_at,
          }));

        const roomBlocks = (blocks || [])
          .filter((blk) => blk.room_id === room.id)
          .map((blk) => ({
            id: blk.id,
            roomId: blk.room_id,
            blockedFrom: blk.blocked_from,
            blockedTo: blk.blocked_to,
            reason: blk.reason,
            note: blk.note,
            createdByStaffId: blk.created_by,
            createdAt: blk.created_at,
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

      return NextResponse.json(
        {
          month: monthParam,
          daysInMonth,
          rooms: ganttRooms,
        },
        {
          headers: {
            ...NO_CACHE_HEADERS,
            ETag: etag,
          },
        }
      );
    }

    // MODE 2: SINGLE DAY VIEW
    const targetDate = dateParam || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const startOfDay = `${targetDate}T00:00:00`;
    const endOfDay = `${targetDate}T23:59:59`;

    // High-performance single round-trip batch query on Cloudflare D1
    const [bookingsBatch, blocksBatch] = await db.batch([
      db
        .prepare(
          `SELECT id, room_id, member_phone, member_name, instagram, facebook, closing_note, booking_type, checkin_at, checkout_at, total_price, status, note
           FROM bookings
           WHERE status NOT IN ('cancelled', 'no_show')
             AND checkin_at <= ?
             AND checkout_at >= ?
           ORDER BY checkin_at ASC`
        )
        .bind(endOfDay, startOfDay),
      db
        .prepare(
          `SELECT id, room_id, blocked_from, blocked_to, reason, note, created_by, created_at
           FROM room_blocks
           WHERE blocked_from <= ? AND blocked_to >= ?
           ORDER BY blocked_from ASC`
        )
        .bind(endOfDay, startOfDay),
    ]);

    const bookings = (bookingsBatch?.results || []) as Booking[];
    const blocks = (blocksBatch?.results || []) as RoomBlock[];

    const ganttRooms = (rooms || []).map((room) => {
      const roomBookings = (bookings || [])
        .filter((b) => b.room_id === room.id)
        .map((b) => ({
          id: b.id,
          roomId: b.room_id,
          guestName: b.member_name,
          phone: b.member_phone,
          instagram: b.instagram,
          facebook: b.facebook,
          closingNote: b.closing_note,
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
          note: blk.note,
          createdByStaffId: blk.created_by,
          createdAt: blk.created_at,
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

    return NextResponse.json(responseData, {
      headers: {
        ...NO_CACHE_HEADERS,
        ETag: etag,
      },
    });
  } catch (error) {
    console.error("GET gantt data error:", error);
    return NextResponse.json({ error: "Failed to fetch gantt data" }, { status: 500 });
  }
}
