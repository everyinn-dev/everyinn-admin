"use client";
/**
 * LSB-6 — OTA-style calendar (Lịch giá & phòng): rooms × dates with the effective base price of one rate plan,
 * calendar overrides, closures (stop-sell / maintenance / owner stay / deep cleaning), occupancy and the web
 * advance-booking window. Managers select a range (drag with a mouse, or tap the first then the last cell on a
 * phone) and change the price, close / reopen the rooms or go back to the list price. Everyone else views.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { RateOverrideDrawer } from "@/components/calendar/RateOverrideDrawer";
import { StopSellModal } from "@/components/calendar/StopSellModal";
import { BookingWindowCard } from "@/components/calendar/BookingWindowCard";
import { CLASS_LABEL, PLAN_LABEL, WEEKDAY, addDays, dm, weekdayOf, type CalendarMatrix, type CalendarPlan, type CalendarSelection } from "@/components/calendar/types";
import { subscribeToSyncEvents, notifyDataChanged } from "@/lib/syncEvents";

const SPAN = 31;
const todayVn = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const k = (n: number | null) => (n === null ? "—" : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
type Cell = { r: number; d: number };

export default function CalendarPage() {
  const toast = useToast();
  const [start, setStart] = useState(todayVn);
  const [plan, setPlan] = useState<CalendarPlan>("overnight");
  const [data, setData] = useState<CalendarMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [focus, setFocus] = useState<Cell | null>(null);
  const [pending, setPending] = useState(false); // touch: waiting for the second tap
  const [dragging, setDragging] = useState(false);
  const [panel, setPanel] = useState<"price" | "close" | null>(null);
  const [confirm, setConfirm] = useState<"reopen" | "clear" | null>(null);
  const [busy, setBusy] = useState(false);
  const etag = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? (r.json() as Promise<{ staff?: { role?: string } | null }>) : null))
      .then((me) => setIsManager(me?.staff?.role === "manager"))
      .catch(() => undefined);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/calendar/matrix?from=${start}&to=${addDays(start, SPAN - 1)}`, { cache: "no-store", headers: etag.current && silent ? { "If-None-Match": etag.current } : {} });
        if (res.status === 304) return;
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Không tải được lịch.");
        etag.current = res.headers.get("ETag");
        setData((await res.json()) as CalendarMatrix);
      } catch (err) {
        if (!silent) toast.error(err instanceof Error ? err.message : "Không tải được lịch.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [start, toast],
  );

  useEffect(() => {
    etag.current = null;
    void load();
  }, [load]);
  // live enough: ETag poll every 30 s while visible + cross-tab refresh (Gantt / bookings changed)
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && void load(true), 30_000);
    const off = subscribeToSyncEvents((e) => (e === "BOOKINGS_CHANGED" || e === "ROOM_BLOCKS_CHANGED") && void load(true));
    return () => {
      clearInterval(t);
      off();
    };
  }, [load]);

  const rect = useMemo(() => {
    if (!anchor || !focus) return null;
    return { r0: Math.min(anchor.r, focus.r), r1: Math.max(anchor.r, focus.r), d0: Math.min(anchor.d, focus.d), d1: Math.max(anchor.d, focus.d) };
  }, [anchor, focus]);
  const inRect = (r: number, d: number) => !!rect && r >= rect.r0 && r <= rect.r1 && d >= rect.d0 && d <= rect.d1;
  const selection: CalendarSelection | null = useMemo(() => {
    if (!rect || !data || pending) return null;
    const dates = data.rooms[0]?.days.map((x) => x.date) ?? [];
    return { rooms: data.rooms.slice(rect.r0, rect.r1 + 1), from: dates[rect.d0]!, to: dates[rect.d1]! };
  }, [rect, data, pending]);

  const clearSel = () => {
    setAnchor(null);
    setFocus(null);
    setPending(false);
    setConfirm(null);
  };

  const onDown = (e: React.PointerEvent, c: Cell) => {
    if (!isManager) return;
    if (e.pointerType === "mouse") {
      setAnchor(c);
      setFocus(c);
      setPending(false);
      setDragging(true);
      return;
    }
    // touch / pen: tap the first cell, then the last one (the grid keeps scrolling with a finger)
    if (pending && anchor) {
      setFocus(c);
      setPending(false);
    } else {
      setAnchor(c);
      setFocus(c);
      setPending(true);
    }
  };
  useEffect(() => {
    if (!dragging) return;
    const up = () => setDragging(false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [dragging]);

  const closuresInSel = useMemo(() => {
    if (!selection) return [];
    const seen = new Map<string, { id: string; version: number }>();
    for (const room of selection.rooms) for (const day of room.days) if (day.date >= selection.from && day.date <= selection.to) for (const c of day.closures) seen.set(c.id, { id: c.id, version: c.version });
    return [...seen.values()];
  }, [selection]);
  const overridesInSel = useMemo(() => {
    if (!selection) return [];
    const scopes = new Map<string, { roomClass: string; roomId: string | null; plans: Set<CalendarPlan> }>();
    for (const room of selection.rooms)
      for (const day of room.days) {
        if (day.date < selection.from || day.date > selection.to) continue;
        for (const p of Object.keys(day.rates) as CalendarPlan[]) {
          const o = day.rates[p].override;
          if (!o) continue;
          const key = o.scope === "room" ? room.id : `*${room.roomClass}`;
          const s = scopes.get(key) ?? { roomClass: room.roomClass, roomId: o.scope === "room" ? room.id : null, plans: new Set<CalendarPlan>() };
          s.plans.add(p);
          scopes.set(key, s);
        }
      }
    return [...scopes.values()];
  }, [selection]);

  const done = () => {
    setPanel(null);
    clearSel();
    notifyDataChanged("ROOM_BLOCKS_CHANGED");
    void load(true);
  };

  const reopen = async () => {
    setBusy(true);
    try {
      for (const c of closuresInSel) {
        const res = await fetch(`/api/room-blocks/${encodeURIComponent(c.id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: c.version, reason: "Mở bán lại từ Lịch giá & phòng" }) });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Không mở bán lại được.");
      }
      toast.success(`Đã mở bán lại ${closuresInSel.length} lịch đóng.`);
      done();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không mở bán lại được.");
      void load(true);
    } finally {
      setBusy(false);
    }
  };

  const backToList = async () => {
    if (!selection) return;
    setBusy(true);
    try {
      for (const s of overridesInSel) {
        const res = await fetch("/api/rate-overrides/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomClass: s.roomClass, roomId: s.roomId, ratePlanCodes: [...s.plans], fromDate: selection.from, toDate: selection.to }) });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Không khôi phục được giá.");
      }
      toast.success("Đã về giá niêm yết.");
      done();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không khôi phục được giá.");
    } finally {
      setBusy(false);
    }
  };

  const dates = data?.rooms[0]?.days.map((x) => x.date) ?? [];
  const classOrder = data ? [...new Set(data.rooms.map((r) => r.roomClass))] : [];

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 pb-28">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">📅 Lịch giá & phòng</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Giá cơ bản theo ngày, đóng / mở bán phòng và cửa sổ khách web được đặt trước. {isManager ? "Kéo chuột (hoặc chạm ô đầu rồi ô cuối) để chọn." : "Chỉ quản lý được chỉnh."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStart(addDays(start, -14))} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700" aria-label="Lùi 2 tuần">
              ←
            </button>
            <button type="button" onClick={() => setStart(todayVn())} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700">
              Hôm nay
            </button>
            <button type="button" onClick={() => setStart(addDays(start, 14))} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700" aria-label="Tới 2 tuần">
              →
            </button>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl w-fit" role="tablist" aria-label="Loại giá">
            {(data?.ratePlans ?? (["overnight", "combo3h", "dayroom"] as CalendarPlan[])).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={plan === p} onClick={() => setPlan(p)} className={`h-9 px-3 rounded-lg text-sm font-bold ${plan === p ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600"}`}>
                {PLAN_LABEL[p]}
              </button>
            ))}
          </div>
          {data ? <BookingWindowCard window={data.bookingWindow} canEdit={isManager} onSaved={() => void load(true)} /> : null}
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Giá theo lịch</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[repeating-linear-gradient(45deg,#fde68a,#fde68a_3px,#fef3c7_3px,#fef3c7_6px)] border border-amber-300" /> Đóng bán / bảo trì</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-sky-500" /> Lấp đầy trong ngày</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Ngoài cửa sổ đặt web</span>
        </div>

        {loading && !data ? (
          <div className="h-64 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : data ? (
          <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto select-none" onPointerLeave={() => setDragging(false)}>
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-white border-b border-r border-slate-200 px-3 py-2 text-left font-bold text-slate-500 min-w-28">Phòng</th>
                  {dates.map((d) => {
                    const wd = weekdayOf(d);
                    return (
                      <th key={d} className={`border-b border-slate-200 px-1 py-1.5 min-w-16 font-semibold ${d === data.today ? "bg-emerald-50 text-emerald-800" : wd === 0 || wd === 6 ? "bg-slate-50 text-slate-700" : "text-slate-600"}`}>
                        <span className="block text-[10px] uppercase">{WEEKDAY[wd]}</span>
                        <span className="block tabular-nums">{dm(d)}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {classOrder.map((cls) => (
                  <React.Fragment key={cls}>
                    <tr>
                      <td colSpan={dates.length + 1} className="sticky left-0 bg-slate-50 border-b border-slate-200 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                        {CLASS_LABEL[cls]}
                      </td>
                    </tr>
                    {data.rooms.map((room, r) =>
                      room.roomClass !== cls ? null : (
                        <tr key={room.id}>
                          <th scope="row" className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 px-3 py-2 text-left font-bold text-slate-800 whitespace-nowrap">
                            {room.roomNumber}
                            <span className="block text-[10px] font-medium text-slate-500">{room.name}</span>
                          </th>
                          {room.days.map((day, d) => {
                            const rate = day.rates[plan];
                            const closed = day.closures[0];
                            const past = day.date < data.today;
                            const sel = inRect(r, d);
                            return (
                              <td
                                key={day.date}
                                data-cell
                                onPointerDown={(e) => !past && onDown(e, { r, d })}
                                onPointerEnter={() => dragging && setFocus({ r, d })}
                                title={[
                                  `${room.name} · ${dm(day.date)}`,
                                  rate.override ? `Giá theo lịch ${rate.price?.toLocaleString("vi-VN")}đ (niêm yết ${rate.listPrice?.toLocaleString("vi-VN")}đ)${rate.override.note ? ` — ${rate.override.note}` : ""}` : `Giá niêm yết ${rate.price?.toLocaleString("vi-VN")}đ`,
                                  closed ? `${data.blockTypes.find((b) => b.code === closed.blockType)?.label ?? "Đóng"}: ${closed.reason}` : "",
                                  day.bookings ? `${day.bookings} đặt phòng` : "",
                                  day.holds ? `${day.holds} đang giữ` : "",
                                  day.bookable ? "" : "Ngoài cửa sổ đặt trước của khách web",
                                ]
                                  .filter(Boolean)
                                  .join("\n")}
                                className={`relative h-14 border-b border-r border-slate-100 text-center align-middle tabular-nums ${isManager && !past ? "cursor-pointer" : ""} ${past ? "opacity-40" : ""} ${
                                  sel ? "outline-2 -outline-offset-2 outline-emerald-500 bg-emerald-50/60" : closed ? "bg-[repeating-linear-gradient(45deg,#fef3c7,#fef3c7_6px,#fde68a_6px,#fde68a_12px)]" : !day.bookable ? "bg-slate-100" : ""
                                }`}
                              >
                                {closed ? (
                                  <span className="block text-[10px] font-bold text-amber-900 leading-tight px-0.5">{data.blockTypes.find((b) => b.code === closed.blockType)?.label ?? "Đóng"}</span>
                                ) : (
                                  <span className={`block font-bold ${rate.override ? "text-emerald-700" : "text-slate-800"}`}>
                                    {rate.override ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-0.5 align-middle" aria-label="giá theo lịch" /> : null}
                                    {k(rate.price)}
                                  </span>
                                )}
                                {day.holds > 0 ? <span className="absolute top-0.5 right-0.5 text-[9px]" aria-label="đang giữ">⏳</span> : null}
                                {day.occupancyPct > 0 ? <span className="absolute left-0 bottom-0 h-1 bg-sky-500" style={{ width: `${day.occupancyPct}%` }} /> : null}
                              </td>
                            );
                          })}
                        </tr>
                      ),
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Action bar — sits above the mobile bottom nav */}
      {isManager && (selection || pending) ? (
        <div className="fixed left-0 right-0 bottom-16 lg:bottom-4 z-40 px-4">
          <div className="max-w-3xl mx-auto rounded-2xl bg-white border border-slate-200 shadow-lg p-3 space-y-2">
            {pending ? (
              <p className="text-sm text-slate-700">Chạm ô cuối để chọn dải ngày / phòng.</p>
            ) : selection ? (
              <>
                <p className="text-sm font-bold text-slate-900">
                  {selection.rooms.map((r) => r.roomNumber).join(", ")} · {dm(selection.from)} → {dm(selection.to)}
                </p>
                {confirm ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-700">
                      {confirm === "reopen" ? `Mở bán lại ${closuresInSel.length} lịch đóng (cả phần nằm ngoài vùng chọn)?` : "Về giá niêm yết cho vùng đã chọn?"}
                    </span>
                    <button type="button" disabled={busy} onClick={confirm === "reopen" ? reopen : backToList} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold">
                      Đồng ý
                    </button>
                    <button type="button" onClick={() => setConfirm(null)} className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700">
                      Thôi
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setPanel("price")} className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold">
                      💰 Đổi giá
                    </button>
                    <button type="button" onClick={() => setPanel("close")} className="h-10 px-4 rounded-xl bg-amber-500 text-white text-sm font-bold">
                      ⛔ Đóng bán
                    </button>
                    {closuresInSel.length > 0 ? (
                      <button type="button" onClick={() => setConfirm("reopen")} className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-800">
                        ✅ Mở bán lại
                      </button>
                    ) : null}
                    {overridesInSel.length > 0 ? (
                      <button type="button" onClick={() => setConfirm("clear")} className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-800">
                        ↺ Về giá niêm yết
                      </button>
                    ) : null}
                    <button type="button" onClick={clearSel} className="h-10 px-3 rounded-xl text-sm font-bold text-slate-500 ml-auto">
                      Bỏ chọn
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {panel === "price" && selection && data ? <RateOverrideDrawer selection={selection} plans={data.ratePlans} defaultPlan={plan} onClose={() => setPanel(null)} onDone={done} /> : null}
      {panel === "close" && selection && data ? <StopSellModal selection={selection} blockTypes={data.blockTypes} onClose={() => setPanel(null)} onDone={done} /> : null}
    </AdminShell>
  );
}
