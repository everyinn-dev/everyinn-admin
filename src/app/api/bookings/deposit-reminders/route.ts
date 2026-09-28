import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Vietnam date (UTC+7)
    const nowVn = new Date(Date.now() + 7 * 3600 * 1000);
    const todayStr = nowVn.toISOString().slice(0, 10);
    const todayStartIso = `${todayStr}T00:00:00`;

    // 1. Lightweight Event-Version Check (1 D1 Row Read)
    const eventRow = await db
      .prepare("SELECT COALESCE(MAX(id), 0) as last_event_id FROM event_logs")
      .first<{ last_event_id: number }>();
    const lastEventId = eventRow?.last_event_id || 0;

    const etag = `W/"dep-rem-${lastEventId}-${todayStr}"`;
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

    // 2. Query bookings due for remaining deposit collection (Indexed seek)
    const { results } = await db
      .prepare(
        `SELECT 
           b.id,
           b.room_id,
           r.name as room_name,
           r.room_class,
           b.member_name,
           b.member_phone,
           b.instagram,
           b.facebook,
           b.booking_type,
           b.checkin_at,
           b.checkout_at,
           b.total_price,
           b.deposit_amount,
           b.paid_amount,
           b.remaining_amount,
           b.deposit_due_date,
           b.deposit_status,
           b.deposit_paid_at,
           b.deposit_reminder_sent_at,
           b.closing_note,
           b.note
         FROM bookings b
         LEFT JOIN rooms r ON b.room_id = r.id
         WHERE b.is_deposit = 1 
           AND b.deposit_status = 'deposit_paid'
           AND b.status NOT IN ('cancelled', 'no_show')
           AND b.deposit_due_date <= ?
           AND (b.deposit_reminder_sent_at IS NULL OR b.deposit_reminder_sent_at < ?)
         ORDER BY b.deposit_due_date ASC, b.checkin_at ASC`
      )
      .bind(todayStr, todayStartIso)
      .all<any>();

    return NextResponse.json(
      {
        reminders: results || [],
        count: results ? results.length : 0,
        today: todayStr,
      },
      {
        headers: {
          ...NO_CACHE_HEADERS,
          ETag: etag,
        },
      }
    );
  } catch (error: any) {
    console.error("GET deposit reminders error:", error);
    return NextResponse.json(
      { error: "Lỗi tải thông tin nhắc nhở đặt cọc." },
      { status: 500 }
    );
  }
}
