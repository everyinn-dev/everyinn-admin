import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import { daysInMonthOf, toGanttRoom, type CoreGantt } from "@/lib/coreMappers";
import type { GanttDataResponse } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

/** Gantt comes from Booking Core (slot-backed, `bookingsVersion` ETag) — no direct booking SQL in Admin. */
export async function GET(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM
    const date = searchParams.get("date"); // YYYY-MM-DD

    const res = await bookingCore.get<CoreGantt>("/internal/v1/gantt", {
      staff,
      query: month ? { month } : { date },
      ifNoneMatch: req.headers.get("if-none-match"),
    });

    if (res.status === 304) {
      return new NextResponse(null, { status: 304, headers: { ETag: res.etag ?? "", "Cache-Control": "no-cache" } });
    }

    const g = res.data!;
    const rooms = g.rooms.map((r) => toGanttRoom(r, Boolean(month)));
    const body: GanttDataResponse = month
      ? { month: g.month ?? month, daysInMonth: g.daysInMonth ?? daysInMonthOf(month), rooms }
      : { date: g.date ?? date ?? undefined, rooms };

    const headers: Record<string, string> = { ...NO_CACHE_HEADERS };
    if (res.etag) headers.ETag = res.etag;
    return NextResponse.json(body, { headers });
  } catch (error) {
    console.error("GET gantt data error:", error);
    return coreErrorResponse(error);
  }
}

