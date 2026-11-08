"use client";
/** LSB-6 — rolling advance-booking window for web / AI guests (receptionists only get a warning beyond it). */
import React, { useState } from "react";
import { useToast } from "../ui/Toast";
import { dm } from "./types";

const PRESETS = [
  { days: 60, label: "2 tháng" },
  { days: 90, label: "3 tháng" },
  { days: 180, label: "6 tháng" },
  { days: 365, label: "1 năm" },
];

export const BookingWindowCard: React.FC<{ window: { maxAdvanceDays: number; maxDate: string }; canEdit: boolean; onSaved: () => void }> = ({ window: w, canEdit, onSaved }) => {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState(String(w.maxAdvanceDays));
  const [busy, setBusy] = useState(false);

  const save = async (days: number) => {
    setBusy(true);
    try {
      const res = await fetch("/api/configs/booking-window", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxAdvanceDays: days }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Không lưu được.");
      toast.success(`Khách web giờ đặt trước được tối đa ${days} ngày.`);
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm flex flex-wrap items-center gap-2">
      <span className="text-slate-700">
        Khách web đặt trước tối đa <b className="text-slate-900">{w.maxAdvanceDays} ngày</b> (đến {dm(w.maxDate)}/{w.maxDate.slice(0, 4)})
      </span>
      {canEdit && !editing ? (
        <button type="button" onClick={() => setEditing(true)} className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700">
          Đổi
        </button>
      ) : null}
      {editing ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.days} type="button" disabled={busy} onClick={() => save(p.days)} className={`h-9 px-3 rounded-lg border text-xs font-bold ${w.maxAdvanceDays === p.days ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-white border-slate-300 text-slate-700"}`}>
              {p.label}
            </button>
          ))}
          <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Số ngày tuỳ chọn" className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-xs bg-white tabular-nums" />
          <button type="button" disabled={busy} onClick={() => save(Math.round(Number(custom)))} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold">
            Lưu
          </button>
          <button type="button" onClick={() => setEditing(false)} className="h-9 px-2 text-xs font-bold text-slate-500">
            Huỷ
          </button>
        </span>
      ) : null}
    </div>
  );
};
