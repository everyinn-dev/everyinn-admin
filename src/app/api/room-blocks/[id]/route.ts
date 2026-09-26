import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { invalidatePrefix } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function DELETE(
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
    const blockId = parseInt(id, 10);
    if (isNaN(blockId)) {
      return NextResponse.json({ error: "ID khóa phòng không hợp lệ." }, { status: 400 });
    }

    const existing = await db
      .prepare(
        `SELECT rb.*, r.name as room_name
         FROM room_blocks rb
         LEFT JOIN rooms r ON rb.room_id = r.id
         WHERE rb.id = ?
         LIMIT 1`
      )
      .bind(blockId)
      .first<{
        id: number;
        room_id: string;
        room_name?: string;
        blocked_from: string;
        blocked_to: string;
        reason?: string;
      }>();

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy thông tin khóa phòng cần mở." }, { status: 404 });
    }

    await db.prepare("DELETE FROM room_blocks WHERE id = ?").bind(blockId).run();

    await logEvent(
      db,
      "ROOM_BLOCK_DELETED",
      "room_block",
      String(blockId),
      {
        roomId: existing.room_id,
        roomName: existing.room_name,
        blockedFrom: existing.blocked_from,
        blockedTo: existing.blocked_to,
        reason: existing.reason,
        deletedByStaffId: staff.id,
      },
      staff.id
    );

    // Invalidate Gantt chart caches
    invalidatePrefix("dashboard:gantt:");

    return NextResponse.json({
      success: true,
      message: `Đã mở khóa phòng ${existing.room_name || existing.room_id} thành công.`,
    });
  } catch (error: any) {
    console.error("DELETE room block error:", error);
    return NextResponse.json(
      { error: error?.message || "Đã xảy ra lỗi khi mở khóa phòng." },
      { status: 500 }
    );
  }
}
