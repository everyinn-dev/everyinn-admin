import { getCurrentStaff } from "@/lib/auth";
import { agentCore, bookingCore } from "@/lib/cores";
import { chunkArray } from "@/lib/doorCodeUtils";
import { applyDoorCodes, applyOpsStates, type BookingOpsStateEntry, type DoorCodeResult } from "@/lib/rosterDoorCodes";
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
 * GET /api/bookings/daily-roster — Operational hub daily roster from Booking Core
 * enriched with chunked door-code resolution & 2-way Telegram/Admin ops state from Agent Core.
 */
export async function GET(req: Request) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date")?.trim() || getVnToday();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return Response.json(
        { error: "Định dạng ngày không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD." },
        { status: 400 }
      );
    }

    // Do not short-circuit on Booking Core ETag so 2-way agent-core state (door codes, guide/HK sync) stays fresh.
    const coreRes = await bookingCore.get<CoreDailyRosterResponse>(
      "/internal/v1/daily-roster",
      {
        staff,
        query: { date: dateParam },
      }
    );

    if (!coreRes.data) {
      throw new Error("Không nhận được dữ liệu lịch điều phối từ Booking Core.");
    }

    let roster = toDailyRosterResponse(coreRes.data);

    // 1. Door codes live in agent-core vault (chunked at 20 per agent-core limit).
    const stays = roster.checkins.map((c) => ({
      bookingId: c.id,
      roomId: c.roomId,
      checkinAt: c.checkinAt,
      checkoutAt: c.checkoutAt,
    }));
    const opsIds = [
      ...roster.checkins.map((c) => c.id),
      ...roster.checkouts.map((c) => c.id),
      ...(roster.housekeepingTasks ?? []).map((t) => t.refId),
    ];

    const [codeResults, opsStateMap] = await Promise.all([
      (async (): Promise<DoorCodeResult[]> => {
        if (stays.length === 0) return [];
        const merged: DoorCodeResult[] = [];
        for (const chunk of chunkArray(stays, 20)) {
          try {
            const res = await agentCore.post<{ results: DoorCodeResult[] }>("/internal/v1/door-codes/resolve-batch", {
              staff,
              body: { stays: chunk, reveal: true },
              timeoutMs: 4000,
              maxAttempts: 1,
            });
            if (res.data?.results) merged.push(...res.data.results);
          } catch (e) {
            console.warn("daily-roster: door codes chunk unavailable", e instanceof Error ? e.message : e);
          }
        }
        return merged;
      })(),
      (async (): Promise<Record<string, BookingOpsStateEntry>> => {
        if (opsIds.length === 0) return {};
        const merged: Record<string, BookingOpsStateEntry> = {};
        for (const chunk of chunkArray([...new Set(opsIds)], 100)) {
          try {
            const res = await agentCore.post<{ states: Record<string, BookingOpsStateEntry> }>("/internal/v1/ops/booking-state/batch", {
              staff,
              body: { bookingIds: chunk },
              timeoutMs: 4000,
              maxAttempts: 1,
            });
            if (res.data?.states) Object.assign(merged, res.data.states);
          } catch (e) {
            console.warn("daily-roster: ops state unavailable", e instanceof Error ? e.message : e);
          }
        }
        return merged;
      })(),
    ]);

    if (codeResults.length > 0) {
      roster = applyDoorCodes(roster, codeResults);
    }
    roster = applyOpsStates(roster, opsStateMap);

    return Response.json(roster, {
      headers: NO_CACHE_HEADERS,
    });
  } catch (error: unknown) {
    return toHttpError(error);
  }
}
