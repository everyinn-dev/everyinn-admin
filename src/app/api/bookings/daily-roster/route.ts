import { getCurrentStaff } from "@/lib/auth";
import { agentCore, bookingCore } from "@/lib/cores";
import { applyDoorCodes, type DoorCodeResult } from "@/lib/rosterDoorCodes";
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
    const staff = await getCurrentStaff();
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

    let roster = toDailyRosterResponse(coreRes.data);
    // Door codes live in the AI receptionist vault (agent-core). Best effort: the roster works without them.
    const stays = roster.checkins.slice(0, 20).map((c) => ({ bookingId: c.id, roomId: c.roomId, checkinAt: c.checkinAt, checkoutAt: c.checkoutAt }));
    if (stays.length) {
      try {
        const codes = await agentCore.post<{ results: DoorCodeResult[] }>("/internal/v1/door-codes/resolve-batch", { staff, body: { stays, reveal: true }, timeoutMs: 4000, maxAttempts: 1 });
        if (codes.data) roster = applyDoorCodes(roster, codes.data.results);
      } catch (e) {
        console.warn("daily-roster: door codes unavailable", e instanceof Error ? e.message : e);
      }
    }

    return Response.json(roster, {
      headers: {
        ...NO_CACHE_HEADERS,
        ...(coreRes.etag ? { ETag: coreRes.etag } : {}),
      },
    });
  } catch (error: any) {
    return toHttpError(error);
  }
}
