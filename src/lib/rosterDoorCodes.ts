import type { DailyRosterResponse } from "@/types";

/**
 * AI-4b / BUG-14: Booking Core never holds door codes (contract), so the roster's `doorCode` is filled from
 * everyinn-agent-core (`POST /internal/v1/door-codes/resolve-batch`). Missing parts stay empty → "Chưa có".
 */
export interface DoorCodeResult {
  bookingId: string;
  resolved: { missing: Array<"gate" | "lockbox"> };
  gateCode: string | null;
  lockboxCode: string | null;
}

export function applyDoorCodes(roster: DailyRosterResponse, results: DoorCodeResult[]): DailyRosterResponse {
  const byId = new Map(results.map((r) => [r.bookingId, r]));
  const fill = <T extends { id: string; doorCode?: string | null }>(item: T): T => {
    const r = byId.get(item.id);
    if (!r || r.resolved.missing.length || !r.gateCode || !r.lockboxCode) return item;
    return { ...item, doorCode: `Cổng ${r.gateCode} · Hộp khóa ${r.lockboxCode}` };
  };
  const checkins = roster.checkins.map(fill);
  return {
    ...roster,
    checkins,
    checkouts: roster.checkouts.map(fill),
    summary: { ...roster.summary, doorCodeMissingCount: checkins.filter((c) => !c.doorCode).length },
  };
}
