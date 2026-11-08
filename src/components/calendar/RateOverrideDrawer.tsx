"use client";
/**
 * LSB-6 — set a custom base price for the selected rooms × dates. Scope: each selected room, or the whole room
 * class (a room price wins over the class price). Promotions, vouchers and stamp rewards still apply on top.
 */
import React, { useMemo, useState } from "react";
import { useToast } from "../ui/Toast";
import { vnd } from "@/shared/booking-kit/format";
import { CLASS_LABEL, PLAN_LABEL, WEEKDAY, dm, type CalendarPlan, type CalendarSelection } from "./types";

interface Props {
  selection: CalendarSelection;
  plans: CalendarPlan[];
  defaultPlan: CalendarPlan;
  onClose: () => void;
  onDone: () => void;
}

export const RateOverrideDrawer: React.FC<Props> = ({ selection, plans, defaultPlan, onClose, onDone }) => {
  const toast = useToast();
  const classes = useMemo(() => [...new Set(selection.rooms.map((r) => r.roomClass))], [selection.rooms]);
  const [scope, setScope] = useState<"rooms" | "class">("rooms");
  const [picked, setPicked] = useState<CalendarPlan[]>([defaultPlan]);
  const [price, setPrice] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const firstDay = selection.rooms[0]?.days.find((d) => d.date === selection.from);
  const hint = picked.length === 1 && firstDay ? firstDay.rates[picked[0]]?.listPrice : null;

  const submit = async () => {
    const n = Math.round(Number(price.replace(/[^\d]/g, "")));
    if (!price.trim() || !Number.isFinite(n)) return toast.error("Nhập giá mới.");
    if (picked.length === 0) return toast.error("Chọn ít nhất một loại giá.");
    setBusy(true);
    try {
      const base = { ratePlanCodes: picked, fromDate: selection.from, toDate: selection.to, customBasePrice: n, note, weekdays };
      const calls =
        scope === "class"
          ? classes.map((c) => ({ ...base, roomClass: c, roomId: null }))
          : selection.rooms.map((r) => ({ ...base, roomClass: r.roomClass, roomId: r.id }));
      for (const body of calls) {
        const res = await fetch("/api/rate-overrides", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) {
          const e = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(e.error ?? "Không đổi được giá.");
        }
      }
      toast.success(`Đã đặt giá ${vnd(n)} cho ${dm(selection.from)}–${dm(selection.to)}.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không đổi được giá.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Đổi giá theo lịch">
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-xl overflow-y-auto flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Đổi giá theo lịch</p>
            <h2 className="text-lg font-black text-slate-900">
              {dm(selection.from)} → {dm(selection.to)} · {selection.rooms.length} phòng
            </h2>
          </div>
          <button type="button" onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-500" aria-label="Đóng">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Áp dụng cho</legend>
            {(["rooms", "class"] as const).map((v) => (
              <label key={v} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${scope === v ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
                <input type="radio" name="scope" checked={scope === v} onChange={() => setScope(v)} className="accent-emerald-600" />
                <span className="text-sm text-slate-800">
                  {v === "rooms" ? `Phòng đã chọn: ${selection.rooms.map((r) => r.roomNumber).join(", ")}` : `Cả hạng ${classes.map((c) => CLASS_LABEL[c]).join(" + ")} (giá riêng từng phòng vẫn ưu tiên)`}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Loại giá</legend>
            <div className="flex flex-wrap gap-1.5">
              {plans.map((p) => {
                const on = picked.includes(p);
                return (
                  <button key={p} type="button" onClick={() => setPicked(on ? picked.filter((x) => x !== p) : [...picked, p])} className={`h-10 px-3 rounded-xl border text-sm font-bold ${on ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-white border-slate-200 text-slate-600"}`} aria-pressed={on}>
                    {PLAN_LABEL[p]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Giá cơ bản mới (VND)</span>
            <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={hint ? `Giá niêm yết ${hint.toLocaleString("vi-VN")}` : "VD: 450000"} className="mt-1.5 w-full h-11 md:h-10 rounded-xl border border-slate-300 px-3 text-sm bg-white tabular-nums" />
            <span className="text-[11px] text-slate-500">Ưu đãi, voucher, tem vẫn trừ trên giá này. Phụ thu thêm giờ giữ nguyên.</span>
          </label>

          <fieldset>
            <legend className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Chỉ các thứ (bỏ trống = mọi ngày)</legend>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = weekdays.includes(d);
                return (
                  <button key={d} type="button" onClick={() => setWeekdays(on ? weekdays.filter((x) => x !== d) : [...weekdays, d])} className={`h-10 w-11 rounded-xl border text-sm font-bold ${on ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-white border-slate-200 text-slate-600"}`} aria-pressed={on}>
                    {WEEKDAY[d]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ghi chú nội bộ</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="VD: Cuối tuần lễ 2/9" className="mt-1.5 w-full h-11 md:h-10 rounded-xl border border-slate-300 px-3 text-sm bg-white" />
          </label>
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700">
            Huỷ
          </button>
          <button type="button" onClick={submit} disabled={busy} className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black disabled:opacity-50">
            {busy ? "Đang lưu…" : "Lưu giá"}
          </button>
        </div>
      </div>
    </div>
  );
};
