"use client";

/**
 * Lịch khoá phòng — every room lock in one place (ROOM_BLOCK_FLOW_REVIEW_2026-11-17 D7):
 * "Đang khoá" (running), "Sắp tới" (upcoming) and "Lịch sử" (ended or reopened, with who reopened it and why).
 * A row opens the same drawer as the Gantt (view / extend / reopen, role-gated by block type).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Spinner } from "@/components/ui/Spinner";
import { RoomLockDetailDrawer } from "@/components/dashboard/RoomLockDetailDrawer";
import { RoomLockModal } from "@/components/dashboard/RoomLockModal";
import { subscribeToSyncEvents } from "@/lib/syncEvents";
import { blockPhase, formatVn, roomBlockTypeOf, ROOM_BLOCK_TYPES } from "@/lib/roomBlocks";
import type { GanttBlockItem, GanttRoomData } from "@/types";

interface LegacyBlock {
  id: string;
  room_id: string;
  room_name: string | null;
  blocked_from: string;
  blocked_to: string;
  reason: string | null;
  note: string | null;
  block_type?: GanttBlockItem["blockType"];
  status: "active" | "released";
  created_by: number | null;
  created_by_staff_name: string | null;
  created_at: string;
  released_at: string | null;
  released_by_staff_name?: string | null;
  release_reason: string | null;
  version: number;
}

type Tab = "active" | "upcoming" | "history";
const TABS: { key: Tab; label: string }[] = [
  { key: "active", label: "Đang khoá" },
  { key: "upcoming", label: "Sắp tới" },
  { key: "history", label: "Lịch sử" },
];

const toItem = (b: LegacyBlock): GanttBlockItem => ({
  id: b.id,
  version: b.version,
  roomId: b.room_id,
  blockedFrom: b.blocked_from,
  blockedTo: b.blocked_to,
  reason: b.reason ?? undefined,
  note: b.note ?? undefined,
  createdByStaffId: b.created_by ?? undefined,
  createdByStaffName: b.created_by_staff_name,
  blockType: b.block_type ?? "maintenance",
  status: b.status,
  createdAt: b.created_at,
});

const tabOf = (b: LegacyBlock): Tab => {
  if (b.status === "released") return "history";
  const p = blockPhase({ blockedFrom: b.blocked_from, blockedTo: b.blocked_to });
  return p === "active" ? "active" : p === "upcoming" ? "upcoming" : "history";
};

function RoomBlocksContent() {
  const [blocks, setBlocks] = useState<LegacyBlock[]>([]);
  const [rooms, setRooms] = useState<GanttRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [isManager, setIsManager] = useState(false);
  const [selected, setSelected] = useState<LegacyBlock | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [a, r] = await Promise.all([
        fetch("/api/room-blocks?status=active", { cache: "no-store" }),
        fetch("/api/room-blocks?status=released", { cache: "no-store" }),
      ]);
      if (!a.ok || !r.ok) throw new Error("Không tải được lịch khoá phòng.");
      const [ja, jr] = (await Promise.all([a.json(), r.json()])) as { blocks: LegacyBlock[] }[];
      setBlocks([...(ja?.blocks ?? []), ...(jr?.blocks ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lịch khoá phòng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/auth/me")
      .then((res) => (res.ok ? (res.json() as Promise<{ staff?: { role?: string } | null }>) : null))
      .then((me) => setIsManager(me?.staff?.role === "manager"))
      .catch(() => undefined);
    fetch("/api/rooms")
      .then((res) => (res.ok ? (res.json() as Promise<{ rooms?: { id: string; name: string; room_number?: string; roomNumber?: string; room_class?: string; floor?: number }[] }>) : null))
      .then((d) =>
        setRooms(
          (d?.rooms ?? []).map((x) => ({
            id: x.id,
            name: x.name,
            roomNumber: x.roomNumber ?? x.room_number ?? x.name,
            roomClass: (x.room_class ?? "haven") as GanttRoomData["roomClass"],
            floor: x.floor ?? 0,
            bookings: [],
            blocks: [],
          })) as unknown as GanttRoomData[],
        ),
      )
      .catch(() => undefined);
    return subscribeToSyncEvents((type) => {
      if (type === "ROOM_BLOCKS_CHANGED" || type === "BOOKINGS_CHANGED") void load();
    });
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { active: 0, upcoming: 0, history: 0 };
    for (const b of blocks) c[tabOf(b)] += 1;
    return c;
  }, [blocks]);

  const rows = useMemo(() => {
    const list = blocks.filter((b) => tabOf(b) === tab && (!typeFilter || (b.block_type ?? "maintenance") === typeFilter));
    const key = (b: LegacyBlock) => Date.parse(tab === "history" ? b.released_at ?? b.blocked_to : b.blocked_from);
    return list.sort((x, y) => (tab === "history" ? key(y) - key(x) : key(x) - key(y)));
  }, [blocks, tab, typeFilter]);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Lịch khoá phòng</h1>
          <p className="text-sm text-slate-500 mt-0.5">Bảo trì, dọn sâu, đóng bán và chủ ở — đang chạy, sắp tới và lịch sử mở khoá.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold">
          🔒 Khoá phòng
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`h-9 px-3 rounded-xl text-sm font-bold border ${tab === t.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"}`}
          >
            {t.label} <span className="opacity-70">({counts[t.key]})</span>
          </button>
        ))}
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 px-2 rounded-xl border border-slate-300 text-sm bg-white ml-auto">
          <option value="">Tất cả loại</option>
          {ROOM_BLOCK_TYPES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-12">Không có lịch khoá nào.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Phòng</th>
                <th className="px-3 py-2">Loại</th>
                <th className="px-3 py-2">Lý do</th>
                <th className="px-3 py-2">Từ</th>
                <th className="px-3 py-2">Đến</th>
                <th className="px-3 py-2">Người tạo</th>
                {tab === "history" && <th className="px-3 py-2">Mở khoá</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => {
                const t = roomBlockTypeOf(b.block_type);
                return (
                  <tr key={b.id} onClick={() => setSelected(b)} className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">{b.room_name ?? b.room_id}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {t.icon} {t.label}
                    </td>
                    <td className="px-3 py-2 max-w-[220px] truncate" title={b.note ?? ""}>
                      {b.reason}
                    </td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{formatVn(b.blocked_from)}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{formatVn(b.blocked_to)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{b.created_by_staff_name ?? "—"}</td>
                    {tab === "history" && (
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {b.status === "released" ? (
                          <>
                            {b.released_by_staff_name ?? "—"} · {b.released_at ? formatVn(b.released_at) : ""}
                            {b.release_reason ? <span className="block text-[10px] text-slate-500">{b.release_reason}</span> : null}
                          </>
                        ) : (
                          <span className="italic">Tự hết hạn</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <RoomLockDetailDrawer
          block={toItem(selected)}
          room={rooms.find((r) => r.id === selected.room_id)}
          isManager={isManager}
          onClose={() => setSelected(null)}
          onBlockDeleted={() => void load()}
        />
      )}
      <RoomLockModal isOpen={creating} onClose={() => setCreating(false)} onSuccess={() => void load()} rooms={rooms} isManager={isManager} />
    </div>
  );
}

export default function RoomBlocksPage() {
  return (
    <AdminShell>
      <RoomBlocksContent />
    </AdminShell>
  );
}
