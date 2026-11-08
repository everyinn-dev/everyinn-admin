import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse, newIdempotencyKey } from "@/lib/cores";
import { clientIdemKey } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const BLOCK_TYPES = ["stop_sell", "maintenance", "owner_stay", "deep_cleaning"];

/** POST /api/room-blocks/bulk — LSB-6 close many rooms in one batch (manager); skipConflicts reports booked rooms. */
export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (staff.role !== "manager") return NextResponse.json({ error: "Chỉ quản lý được đóng / mở bán phòng." }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const roomIds = Array.isArray(body.roomIds) ? body.roomIds.map(String).filter(Boolean) : [];
    if (roomIds.length === 0) return NextResponse.json({ error: "Chọn ít nhất một phòng." }, { status: 400 });
    if (!BLOCK_TYPES.includes(String(body.blockType))) return NextResponse.json({ error: "Chọn lý do đóng phòng." }, { status: 400 });
    const res = await bookingCore.post("/internal/v1/room-blocks/bulk", {
      staff,
      idempotencyKey: clientIdemKey(req) ?? newIdempotencyKey("block-bulk"),
      body: {
        roomIds,
        blockType: body.blockType,
        blockedFrom: body.blockedFrom,
        blockedTo: body.blockedTo,
        skipConflicts: body.skipConflicts === true,
        ...(typeof body.reason === "string" && body.reason.trim() ? { reason: body.reason.trim().slice(0, 200) } : {}),
        ...(typeof body.note === "string" && body.note.trim() ? { note: body.note.trim().slice(0, 1000) } : {}),
      },
    });
    return NextResponse.json(res.data, { status: res.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
