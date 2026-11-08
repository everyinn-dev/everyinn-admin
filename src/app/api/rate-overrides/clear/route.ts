import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import { overrideScope } from "@/lib/calendar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** POST /api/rate-overrides/clear — LSB-6 back to the list price for a date range (manager, audited). */
export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (staff.role !== "manager") return NextResponse.json({ error: "Chỉ quản lý được đổi giá." }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const res = await bookingCore.post("/internal/v1/rate-overrides/clear", { staff, body: overrideScope(body) });
    return NextResponse.json(res.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
