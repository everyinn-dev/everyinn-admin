"use client";
/**
 * LSB-6 — close the selected rooms for the selected dates (one batch in Booking Core). A night of date D runs
 * 12:00 D → 12:00 D+1 (hotel night), or pick whole calendar days. Booked rooms are skipped and listed — a guest's
 * stay is never closed over.
 */
import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { addDays, daysBetween, dm, vnInstant, type BlockType, type CalendarSelection } from "./types";

interface Props {
  selection: CalendarSelection;
  blockTypes: { code: BlockType; label: string }[];
  onClose: () => void;
  onDone: () => void;
}

export const StopSellModal: React.FC<Props> = ({ selection, blockTypes, onClose, onDone }) => {
  const toast = useToast();
  const [blockType, setBlockType] = useState<BlockType>("stop_sell");
  const [mode, setMode] = useState<"night" | "day">("night");
  const [reason, setReason] = useState("");
  const [skip, setSkip] = useState(true);
  const [busy, setBusy] = useState(false);
  const [idem] = useState(() => `bulk-${crypto.randomUUID()}`);
  const tooLong = daysBetween(selection.from, selection.to) > 31;

  const range =
    mode === "night"
      ? { blockedFrom: vnInstant(selection.from, "12:00"), blockedTo: vnInstant(addDays(selection.to, 1), "12:00"), label: `12:00 ${dm(selection.from)} → 12:00 ${dm(addDays(selection.to, 1))}` }
      : { blockedFrom: vnInstant(selection.from, "00:00"), blockedTo: vnInstant(addDays(selection.to, 1), "00:00"), label: `00:00 ${dm(selection.from)} → 24:00 ${dm(selection.to)}` };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/room-blocks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idem },
        body: JSON.stringify({ roomIds: selection.rooms.map((r) => r.id), blockType, blockedFrom: range.blockedFrom, blockedTo: range.blockedTo, reason, skipConflicts: skip }),
      });
      const data = (await res.json().catch(() => ({}))) as { blocks?: unknown[]; skipped?: { roomName: string }[]; error?: string; details?: { skipped?: { roomName: string }[] } };
      if (!res.ok) {
        const names = data.details?.skipped?.map((s) => s.roomName).join(", ");
        throw new Error(names ? `${data.error ?? "Không đóng được."} (${names})` : (data.error ?? "Không đóng được phòng."));
      }
      const skipped = data.skipped ?? [];
      toast.success(`Đã đóng ${data.blocks?.length ?? 0} phòng.`);
      if (skipped.length) toast.warning(`Bỏ qua phòng đang có khách: ${skipped.map((s) => s.roomName).join(", ")}.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không đóng được phòng.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Đóng bán · ${selection.rooms.length} phòng`} maxWidth="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5">
          {blockTypes.map((t) => (
            <button key={t.code} type="button" onClick={() => setBlockType(t.code)} aria-pressed={blockType === t.code} className={`h-11 rounded-xl border text-sm font-bold ${blockType === t.code ? "bg-amber-50 border-amber-400 text-amber-900" : "bg-white border-slate-200 text-slate-600"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Khoảng đóng</legend>
          {(["night", "day"] as const).map((m) => (
            <label key={m} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${mode === m ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} className="accent-amber-600" />
              <span className="text-sm text-slate-800">{m === "night" ? "Theo đêm (12:00 → 12:00 hôm sau)" : "Theo ngày lịch (00:00 → 24:00)"}</span>
            </label>
          ))}
          <p className="text-xs text-slate-500 tabular-nums">{range.label}</p>
        </fieldset>

        <label className="block">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ghi chú cho nhân viên</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="VD: Sửa máy lạnh" className="mt-1.5 w-full h-11 md:h-10 rounded-xl border border-slate-300 px-3 text-sm bg-white" />
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} className="mt-0.5 accent-amber-600" />
          <span>Phòng đang có khách thì bỏ qua (đóng các phòng còn lại)</span>
        </label>

        {tooLong ? <p className="text-sm text-rose-700">Đóng nhiều phòng tối đa 31 ngày mỗi lần — chọn khoảng ngắn hơn.</p> : null}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700">
            Huỷ
          </button>
          <button type="button" onClick={submit} disabled={busy || tooLong} className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-black disabled:opacity-50">
            {busy ? "Đang đóng…" : "Đóng bán"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
