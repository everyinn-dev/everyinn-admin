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

export interface BookingOpsStateEntry {
  bookingId: string;
  checkinGuideStatus: "pending" | "sent_auto" | "sent_manual";
  checkinGuideSentAt: string | null;
  checkinGuideSentByName: string | null;
  hkStatus: "pending" | "cleaning" | "done";
  hkUpdatedAt: string | null;
  hkUpdatedByName: string | null;
}

export function applyDoorCodes(roster: DailyRosterResponse, results: DoorCodeResult[]): DailyRosterResponse {
  const byId = new Map(results.map((r) => [r.bookingId, r]));
  const fill = <
    T extends {
      id: string;
      status?: string;
      doorCode?: string | null;
      doorCodeGate?: string | null;
      doorCodeLockbox?: string | null;
      doorCodeMissing?: Array<"gate" | "lockbox">;
    },
  >(
    item: T,
  ): T => {
    const r = byId.get(item.id);
    if (!r) return item;
    const base = {
      ...item,
      doorCodeGate: r.gateCode,
      doorCodeLockbox: r.lockboxCode,
      doorCodeMissing: r.resolved.missing,
    };
    if (r.resolved.missing.length || !r.gateCode || !r.lockboxCode) return base;
    return { ...base, doorCode: `Cổng ${r.gateCode} · Hộp khóa ${r.lockboxCode}` };
  };
  const checkins = roster.checkins.map(fill);
  return {
    ...roster,
    checkins,
    checkouts: roster.checkouts.map(fill),
    summary: {
      ...roster.summary,
      doorCodeMissingCount: checkins.filter((c) => c.status !== "pending" && !c.doorCode).length,
    },
  };
}

export function applyOpsStates(roster: DailyRosterResponse, states: Record<string, BookingOpsStateEntry>): DailyRosterResponse {
  const mergeItem = <T extends DailyRosterResponse["checkins"][number]>(item: T): T => {
    const st = states[item.id];
    if (!st) return { ...item, checkinGuideStatus: item.checkinGuideStatus ?? "pending", hkStatus: item.hkStatus ?? "pending" };
    return {
      ...item,
      checkinGuideStatus: st.checkinGuideStatus,
      checkinGuideSentAt: st.checkinGuideSentAt,
      checkinGuideSentByName: st.checkinGuideSentByName,
      hkStatus: st.hkStatus,
      hkUpdatedAt: st.hkUpdatedAt,
      hkUpdatedByName: st.hkUpdatedByName,
    };
  };
  const checkins = roster.checkins.map(mergeItem);
  const checkouts = roster.checkouts.map(mergeItem);
  const housekeepingTasks = (roster.housekeepingTasks ?? []).map((t) => {
    const st = states[t.refId];
    return {
      ...t,
      hkStatus: st?.hkStatus ?? t.hkStatus ?? "pending",
      hkUpdatedAt: st?.hkUpdatedAt ?? t.hkUpdatedAt ?? null,
      hkUpdatedByName: st?.hkUpdatedByName ?? t.hkUpdatedByName ?? null,
    };
  });
  return {
    ...roster,
    checkins,
    checkouts,
    housekeepingTasks,
    summary: {
      ...roster.summary,
      pendingCheckinsCount: checkins.filter((c) => c.status === "pending").length,
      guideUnsentCount: checkins.filter((c) => c.status === "confirmed" && (c.checkinGuideStatus ?? "pending") === "pending").length,
      hkDoneCount: housekeepingTasks.filter((t) => t.hkStatus === "done").length,
      hkUrgentCount: housekeepingTasks.filter((t) => t.urgent && t.hkStatus !== "done").length,
    },
  };
}
