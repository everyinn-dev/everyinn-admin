import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/calendar/matrix?from&to — LSB-6 room × date grid (Booking Core, ETag/304 passed through). */
export async function GET(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const from = req.nextUrl.searchParams.get("from") ?? "";
    const to = req.nextUrl.searchParams.get("to") ?? "";
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) return NextResponse.json({ error: "Khoảng ngày không hợp lệ." }, { status: 400 });
    const res = await bookingCore.get("/internal/v1/calendar/matrix", { staff, query: { from, to }, ifNoneMatch: req.headers.get("if-none-match"), maxAttempts: 1 });
    if (res.status === 304) return new NextResponse(null, { status: 304, headers: { ETag: res.etag ?? "", "Cache-Control": "no-cache" } });
    return NextResponse.json(res.data, { headers: { "Cache-Control": "no-store", ...(res.etag ? { ETag: res.etag } : {}) } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
