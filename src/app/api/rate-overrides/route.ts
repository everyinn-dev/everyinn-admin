import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import { overrideScope } from "@/lib/calendar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** PUT /api/rate-overrides — LSB-6 custom base price for a date range (manager). */
export async function PUT(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (staff.role !== "manager") return NextResponse.json({ error: "Chỉ quản lý được đổi giá." }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const price = Math.round(Number(body.customBasePrice));
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Nhập giá hợp lệ." }, { status: 400 });
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : undefined;
    const res = await bookingCore.put("/internal/v1/rate-overrides", { staff, body: { ...overrideScope(body), customBasePrice: price, ...(note ? { note } : {}) } });
    return NextResponse.json(res.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
