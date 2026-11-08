import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import type { CoreCatalog } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * PUT /api/configs/booking-window { maxAdvanceDays } — LSB-6 rolling advance-booking window for web / AI guests
 * (Booking Core booking_rules.max_advance_days; receptionists only get a warning beyond it).
 */
export async function PUT(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (staff.role !== "manager") return NextResponse.json({ error: "Chỉ quản lý được đổi cửa sổ đặt trước." }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as { maxAdvanceDays?: unknown };
    const days = Math.round(Number(body.maxAdvanceDays));
    if (!Number.isInteger(days) || days < 1 || days > 730) return NextResponse.json({ error: "Số ngày đặt trước từ 1 đến 730." }, { status: 400 });
    const catalog = await bookingCore.get<CoreCatalog>("/internal/v1/catalog", { staff });
    const version = (catalog.data!.bookingRules as { version?: number }).version ?? 1;
    const res = await bookingCore.put("/internal/v1/configs/booking_rules", { staff, body: { expectedVersion: version, value: { max_advance_days: days } } });
    return NextResponse.json(res.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
