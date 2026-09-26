import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { invalidatePrefix } from "@/lib/cache";
import { getCachedRooms } from "@/lib/masterData";
import { checkRoomBlockOverlap } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = `
      SELECT rb.*, r.name as room_name, r.room_class, s.full_name as created_by_staff_name
      FROM room_blocks rb
      LEFT JOIN rooms r ON rb.room_id = r.id
      LEFT JOIN staff s ON rb.created_by = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (roomId) {
      query += ` AND rb.room_id = ?`;
      params.push(roomId);
    }
    if (from && to) {
      query += ` AND rb.blocked_from <= ? AND rb.blocked_to >= ?`;
      params.push(to, from);
    }

    query += ` ORDER BY rb.blocked_from DESC LIMIT 50`;

    const stmt = db.prepare(query);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const { results } = await bound.all();

    return NextResponse.json({ blocks: results });
  } catch (error: any) {
    console.error("GET room blocks error:", error);
    return NextResponse.json({ error: "Failed to fetch room blocks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      roomId?: string;
      blockedFrom?: string;
      blockedTo?: string;
      reason?: string;
      note?: string;
    };

    const { roomId, blockedFrom, blockedTo, reason, note } = body;

    if (!roomId || !blockedFrom || !blockedTo) {
      return NextResponse.json(
        { error: "Vui lòng chọn phòng và khoảng thời gian bắt đầu, kết thúc khóa phòng." },
        { status: 400 }
      );
    }

    const rooms = await getCachedRooms(db);
    const targetRoom = rooms.find((r) => r.id === roomId);
    if (!targetRoom) {
      return NextResponse.json({ error: "Phòng được chọn không tồn tại." }, { status: 404 });
    }

    const fromDate = new Date(blockedFrom);
    const toDate = new Date(blockedTo);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || toDate <= fromDate) {
      return NextResponse.json(
        { error: "Thời gian bắt đầu và kết thúc khóa phòng không hợp lệ (giờ kết thúc phải sau giờ bắt đầu)." },
        { status: 400 }
      );
    }

    // Validate collision with bookings and other room blocks
    const overlapResult = await checkRoomBlockOverlap(
      db,
      {
        roomId,
        blockedFrom: fromDate.toISOString(),
        blockedTo: toDate.toISOString(),
      },
      targetRoom.name
    );

    if (overlapResult.hasOverlap) {
      return NextResponse.json(
        {
          error:
            overlapResult.errorMessage ||
            `Không thể khóa phòng ${targetRoom.name} vì bị trùng lịch đặt phòng hoặc lịch khóa khác.`,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const cleanReason = (reason || "Bảo trì / Khóa phòng").trim();
    const cleanNote = note ? note.trim() : null;

    const result = await db
      .prepare(
        `INSERT INTO room_blocks (room_id, blocked_from, blocked_to, reason, note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(roomId, fromDate.toISOString(), toDate.toISOString(), cleanReason, cleanNote, staff.id, now)
      .run();

    const newBlockId = result.meta.last_row_id;

    await logEvent(
      db,
      "ROOM_BLOCK_CREATED",
      "room_block",
      String(newBlockId),
      {
        roomId,
        roomName: targetRoom.name,
        blockedFrom: fromDate.toISOString(),
        blockedTo: toDate.toISOString(),
        reason: cleanReason,
        note: cleanNote,
        staffId: staff.id,
      },
      staff.id
    );

    // Invalidate Gantt chart caches
    invalidatePrefix("dashboard:gantt:");

    return NextResponse.json({
      success: true,
      message: `Đã khóa phòng ${targetRoom.name} thành công.`,
      block: {
        id: newBlockId,
        roomId,
        roomName: targetRoom.name,
        blockedFrom: fromDate.toISOString(),
        blockedTo: toDate.toISOString(),
        reason: cleanReason,
        note: cleanNote,
        createdBy: staff.id,
        createdAt: now,
      },
    });
  } catch (error: any) {
    console.error("POST room block error:", error);
    return NextResponse.json(
      { error: error?.message || "Đã xảy ra lỗi khi tạo khóa phòng." },
      { status: 500 }
    );
  }
}
