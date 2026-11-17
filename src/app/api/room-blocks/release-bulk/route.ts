import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import { toLegacyRoomBlock, type CoreBlock } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";

/**
 * POST /api/room-blocks/release-bulk — reopen several blocks in ONE Core batch (all-or-nothing), used by the
 * calendar "Mở bán lại" and the lock list. Body: { blocks: [{ id, expectedVersion }], reason? }.
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json()) as { blocks?: { id?: unknown; expectedVersion?: unknown }[]; reason?: string };
    const blocks = (body.blocks ?? [])
      .filter((b) => typeof b?.id === "string" && typeof b?.expectedVersion === "number")
      .map((b) => ({ id: b.id as string, expectedVersion: b.expectedVersion as number }));
    if (blocks.length === 0) return NextResponse.json({ error: "Chưa chọn lịch khoá nào để mở.", code: "VALIDATION_FAILED" }, { status: 400 });

    const res = await bookingCore.post<{ released: CoreBlock[]; skipped: { id: string; reason: string }[] }>("/internal/v1/room-blocks/release-bulk", {
      staff,
      body: { blocks, reason: body.reason?.trim() || undefined },
    });
    const released = res.data?.released ?? [];
    const skipped = res.data?.skipped ?? [];
    return NextResponse.json({
      success: true,
      message: `Đã mở ${released.length} lịch khoá${skipped.length ? `, bỏ qua ${skipped.length} (đã mở hoặc đã kết thúc)` : ""}.`,
      released: released.map(toLegacyRoomBlock),
      skipped,
    });
  } catch (error) {
    console.error("POST room-blocks release-bulk error:", error);
    return coreErrorResponse(error);
  }
}
