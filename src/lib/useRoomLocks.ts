"use client";

import { useEffect, useState } from "react";
import { formatVn, roomBlockTypeOf } from "@/lib/roomBlocks";

export interface RoomLockHint {
  blockId: string;
  label: string;
  /** e.g. "🛠️ Bảo trì / chưa sẵn sàng · 08:00 17/11 → 12:00 17/11" */
  text: string;
}

/**
 * Active room locks overlapping [from, to) keyed by room id — lets booking screens grey out locked rooms
 * before submit instead of failing with a 409 (ROOM_BLOCK_FLOW_REVIEW_2026-11-17 D5/D6). Bookings and holds
 * are still checked by Core on submit; this only covers room locks.
 */
export function useRoomLocks(from: Date | string | null | undefined, to: Date | string | null | undefined): Record<string, RoomLockHint> {
  const [locks, setLocks] = useState<Record<string, RoomLockHint>>({});
  const fromIso = from ? new Date(from).toISOString() : "";
  const toIso = to ? new Date(to).toISOString() : "";

  useEffect(() => {
    if (!fromIso || !toIso || Number.isNaN(Date.parse(fromIso)) || Date.parse(toIso) <= Date.parse(fromIso)) {
      setLocks({});
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/room-blocks?status=active&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`, { signal: ctrl.signal, cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ blocks?: { id: string; room_id: string; block_type?: string; reason?: string | null; blocked_from: string; blocked_to: string }[] }>) : null))
        .then((d) => {
          const out: Record<string, RoomLockHint> = {};
          for (const b of d?.blocks ?? []) {
            const type = roomBlockTypeOf(b.block_type);
            out[b.room_id] = { blockId: b.id, label: type.label, text: `${type.icon} ${type.label} · ${formatVn(b.blocked_from)} → ${formatVn(b.blocked_to)}${b.reason && b.reason !== type.label ? ` (${b.reason})` : ""}` };
          }
          setLocks(out);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [fromIso, toIso]);

  return locks;
}
