import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import {
  toLegacyBookingRow,
  type CoreDepositRemindersResponse,
} from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/bookings/deposit-reminders — Delegate deposit reminder queries to Booking Core.
 */
export async function GET(req: Request) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    // Vietnam date (UTC+7) default
    const nowVn = new Date(Date.now() + 7 * 3600 * 1000);
    const todayStr = dateParam?.trim() || nowVn.toISOString().slice(0, 10);
    const ifNoneMatch = req.headers.get("if-none-match");

    const coreRes = await bookingCore.get<CoreDepositRemindersResponse>(
      "/internal/v1/deposit-reminders",
      {
        staff,
        query: { date: todayStr },
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

    const reminders = (coreRes.data?.reminders || []).map(toLegacyBookingRow);

    return Response.json(
      {
        reminders,
        count: coreRes.data?.count ?? reminders.length,
        today: coreRes.data?.today ?? todayStr,
      },
      {
        headers: {
          ...NO_CACHE_HEADERS,
          ...(coreRes.etag ? { ETag: coreRes.etag } : {}),
        },
      }
    );
  } catch (error: any) {
    return toHttpError(error);
  }
}
