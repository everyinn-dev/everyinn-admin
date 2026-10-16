import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import { getVnToday } from "@/lib/timelineUtils";
import {
  toDailyRosterResponse,
  type CoreDailyRosterResponse,
} from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/bookings/daily-roster — Operational hub daily roster from Booking Core.
 */
export async function GET(req: Request) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date")?.trim() || getVnToday();

    // Validate YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return Response.json(
        { error: "Định dạng ngày không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const ifNoneMatch = req.headers.get("if-none-match");

    const coreRes = await bookingCore.get<CoreDailyRosterResponse>(
      "/internal/v1/daily-roster",
      {
        staff,
        query: { date: dateParam },
        ifNoneMatch,
      }
    );

    if (coreRes.status === 304) {
      return new Response(null, {
        status: 304,
        headers: {
          ...(coreRes.etag ? { ETag: coreRes.etag } : {}),
          "Cache-Control": "no-cache",
        },
      });
    }

    if (!coreRes.data) {
      throw new Error("Không nhận được dữ liệu lịch điều phối từ Booking Core.");
    }

    return Response.json(toDailyRosterResponse(coreRes.data), {
      headers: {
        ...NO_CACHE_HEADERS,
        ...(coreRes.etag ? { ETag: coreRes.etag } : {}),
      },
    });
  } catch (error: any) {
    return toHttpError(error);
  }
}
