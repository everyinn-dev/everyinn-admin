import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse, CoreError } from "@/lib/cores";
import type { CoreBlock } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";

/**
 * Legacy "delete block" is a soft **release** in Booking Core: the row is kept for audit and the
 * occupied slots are freed. Release needs `expectedVersion`, so when the UI does not supply one
 * we look the block up first and use its current version.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const blockId = id?.trim();
    if (!blockId) return NextResponse.json({ error: "ID khóa phòng không hợp lệ." }, { status: 400 });

    // Optional body: { expectedVersion?, reason? } — older UI builds send nothing at all.
    let expectedVersion: number | undefined;
    let reason: string | undefined;
    try {
      const body = (await req.json()) as { expectedVersion?: number; reason?: string } | null;
      if (body && typeof body.expectedVersion === "number") expectedVersion = body.expectedVersion;
      if (body && typeof body.reason === "string") reason = body.reason.trim() || undefined;
    } catch {
      /* no body — fall through to lookup */
    }

    let block: CoreBlock | undefined;
    if (expectedVersion === undefined) {
      const list = await bookingCore.get<{ blocks: CoreBlock[] }>("/internal/v1/room-blocks", {
        staff,
        query: { status: "all" },
      });
      block = list.data?.blocks.find((b) => String(b.id) === blockId);
      if (!block) {
        return NextResponse.json({ error: "Không tìm thấy thông tin khóa phòng cần mở." }, { status: 404 });
      }
      expectedVersion = block.version;
    }

    const res = await bookingCore.post<{ block: CoreBlock }>(`/internal/v1/room-blocks/${encodeURIComponent(blockId)}/release`, {
      staff,
      body: { expectedVersion, reason },
    });

    const released = res.data!.block;
    return NextResponse.json({
      success: true,
      message: `Đã mở khóa phòng ${released.roomName ?? released.roomId} thành công.`,
    });
  } catch (error) {
    // A version clash means someone else released/edited it first — tell the user to reload.
    if (error instanceof CoreError && error.code === "VERSION_CONFLICT") {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    console.error("DELETE room block error:", error);
    return coreErrorResponse(error);
  }
}

