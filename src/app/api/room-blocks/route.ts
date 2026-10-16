import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse, newIdempotencyKey } from "@/lib/cores";
import { toLegacyRoomBlock, type CoreBlock } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Room blocks are owned by Booking Core: a block claims the same 30-minute occupancy lane as a
 * booking, so overlap detection and the Gantt stay consistent. Admin no longer touches D1 here.
 */
export async function GET(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query: Record<string, string> = {};
    for (const key of ["roomId", "from", "to", "status"] as const) {
      const v = searchParams.get(key)?.trim();
      if (v) query[key] = v;
    }

    const res = await bookingCore.get<{ blocks: CoreBlock[] }>("/internal/v1/room-blocks", { staff, query });
    return NextResponse.json({ blocks: (res.data?.blocks ?? []).map(toLegacyRoomBlock) }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("GET room blocks error:", error);
    return coreErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      roomId?: string;
      blockedFrom?: string;
      blockedTo?: string;
      reason?: string;
      note?: string;
    };

    if (!body.roomId || !body.blockedFrom || !body.blockedTo) {
      return NextResponse.json(
        { error: "Vui lòng chọn phòng và khoảng thời gian bắt đầu, kết thúc khóa phòng." },
        { status: 400 }
      );
    }

    const from = new Date(body.blockedFrom);
    const to = new Date(body.blockedTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Thời gian khóa phòng không hợp lệ." }, { status: 400 });
    }

    // Core validates range, 30-minute alignment, room existence and overlap atomically and
    // returns a localised 409/422 that `coreErrorResponse` passes straight through to the UI.
    const res = await bookingCore.post<{ block: CoreBlock }>("/internal/v1/room-blocks", {
      staff,
      idempotencyKey: newIdempotencyKey("room-block-create"),
      body: {
        roomId: body.roomId,
        blockedFrom: from.toISOString(),
        blockedTo: to.toISOString(),
        reason: body.reason?.trim() || undefined,
        note: body.note?.trim() || undefined,
      },
    });

    const block = res.data!.block;
    return NextResponse.json({
      success: true,
      message: `Đã khóa phòng ${block.roomName ?? block.roomId} thành công.`,
      block: toLegacyRoomBlock(block),
    });
  } catch (error) {
    console.error("POST room block error:", error);
    return coreErrorResponse(error);
  }
}

