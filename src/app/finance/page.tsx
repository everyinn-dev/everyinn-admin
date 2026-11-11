"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/apiClient";
import { getVnCurrentMonth } from "@/lib/timelineUtils";
import type { RevenueMatrix } from "@/types/finance";

const MAX_MONTHS = 24;
const DEFAULT_MONTHS_BACK = 3;

const moneyFmt = new Intl.NumberFormat("vi-VN");
const formatMoney = (v: number) => `${moneyFmt.format(v)} đ`;
const cellMoney = (v: number) => (v === 0 ? "-" : formatMoney(v));
/** YYYY-MM → MM/YYYY */
const monthLabel = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
const monthCount = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm) + 1;
};

const selectCls =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500";

function MonthPicker({
  label,
  value,
  onChange,
  years,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  years: number[];
}) {
  const [y, m] = value.split("-");
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex gap-1.5">
        <select aria-label={`${label} - tháng`} className={selectCls} value={m} onChange={(e) => onChange(`${y}-${e.target.value}`)}>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((mm) => (
            <option key={mm} value={mm}>
              Tháng {mm}
            </option>
          ))}
        </select>
        <select aria-label={`${label} - năm`} className={selectCls} value={y} onChange={(e) => onChange(`${e.target.value}-${m}`)}>
          {years.map((yy) => (
            <option key={yy} value={yy}>
              {yy}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const currentMonth = useMemo(() => getVnCurrentMonth(), []);
  const defaultFrom = useMemo(() => shiftMonth(currentMonth, -DEFAULT_MONTHS_BACK), [currentMonth]);
  const currentYear = Number(currentMonth.slice(0, 4));
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => currentYear - 4 + i), [currentYear]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(currentMonth);
  const [data, setData] = useState<RevenueMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ETag per window → unchanged data = 304 (no D1 scan, no re-render).
  const etagRef = useRef<{ key: string; etag: string } | null>(null);

  const rangeError = useMemo(() => {
    const n = monthCount(from, to);
    if (n < 1) return "Tháng bắt đầu phải nhỏ hơn hoặc bằng tháng kết thúc.";
    if (n > MAX_MONTHS) return `Tối đa ${MAX_MONTHS} tháng mỗi báo cáo.`;
    return null;
  }, [from, to]);

  const load = useCallback(
    async (force = false) => {
      if (rangeError) return;
      const key = `${from}|${to}`;
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (!force && etagRef.current?.key === key) headers["If-None-Match"] = etagRef.current.etag;
        const res = await apiFetch(`/api/finance/revenue-matrix?from=${from}&to=${to}`, { headers, cache: "no-store" });
        if (res.status === 304) return;
        const body = (await res.json().catch(() => null)) as (Partial<RevenueMatrix> & { error?: string }) | null;
        if (!res.ok) {
          setError(res.status === 403 ? "Chỉ quản lý được xem báo cáo tài chính." : body?.error || "Không thể tải báo cáo doanh thu.");
          setData(null);
          return;
        }
        const etag = res.headers.get("ETag");
        etagRef.current = etag ? { key, etag } : null;
        setData(body as RevenueMatrix);
      } catch {
        setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    },
    [from, to, rangeError],
  );

  useEffect(() => {
    load();
  }, [load]);

  const presetYear = (y: number) => {
    setFrom(`${y}-01`);
    setTo(`${y}-12`);
  };
  const presetDefault = () => {
    setFrom(defaultFrom);
    setTo(currentMonth);
  };

  // Heat shading relative to the busiest cell.
  const maxCell = useMemo(() => Math.max(0, ...(data?.rooms.flatMap((r) => r.values) ?? [0])), [data]);
  const shade = (v: number) => (v > 0 && maxCell > 0 ? `rgba(16, 185, 129, ${(0.06 + (v / maxCell) * 0.22).toFixed(3)})` : undefined);

  const stickyCol = "sticky left-0 z-10";

  return (
    <AdminShell>
      <div className="p-4 lg:p-6 space-y-4 max-w-full">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Báo cáo doanh thu theo phòng</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Doanh thu = giá trị các đơn <b>đã xác nhận</b>, theo tháng <b>check-in</b>. Đơn huỷ / no-show không tính vào doanh thu;
            số tiền khách sạn <b>giữ lại</b> từ các đơn đó (đã thu − đã hoàn) được báo riêng ở dòng “Thu giữ từ huỷ / No-show”.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <MonthPicker label="Từ tháng" value={from} onChange={setFrom} years={years} />
          <MonthPicker label="Đến tháng" value={to} onChange={setTo} years={years} />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={presetDefault}>
              4 tháng gần nhất
            </Button>
            <Button size="sm" variant="outline" onClick={() => presetYear(currentYear)}>
              Năm {currentYear}
            </Button>
            <Button size="sm" variant="outline" onClick={() => presetYear(currentYear - 1)}>
              Năm {currentYear - 1}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => load(true)} isLoading={loading}>
              Làm mới
            </Button>
          </div>
        </div>

        {rangeError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{rangeError}</div>}
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Tổng doanh thu</p>
              <p className="mt-1 text-xl font-bold text-emerald-900 tabular-nums">{formatMoney(data.grandTotal)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Số đơn</p>
              <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{moneyFmt.format(data.bookingCount)}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Thu giữ từ huỷ / No-show</p>
              <p className="mt-1 text-xl font-bold text-amber-900 tabular-nums">{formatMoney(data.retained?.grandTotal ?? 0)}</p>
              <p className="text-[11px] text-amber-800/80">{moneyFmt.format(data.retained?.bookingCount ?? 0)} đơn giữ tiền</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Khoảng thời gian</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {monthLabel(data.from)} – {monthLabel(data.to)}
              </p>
            </div>
          </div>
        )}

        {/* Pivot */}
        <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-auto max-h-[70vh]">
          {loading && !data && (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          )}
          {data && (
            <table className="min-w-full border-separate border-spacing-0 text-sm tabular-nums">
              <thead>
                <tr>
                  <th className={`${stickyCol} top-0 z-30 bg-slate-100 border-b border-r border-slate-200 px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider`}>
                    Phòng
                  </th>
                  {data.months.map((m) => (
                    <th key={m} className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-right text-xs font-bold text-slate-600 whitespace-nowrap">
                      {monthLabel(m)}
                    </th>
                  ))}
                  <th className="sticky top-0 z-20 bg-emerald-100 border-b border-l border-slate-200 px-4 py-2.5 text-right text-xs font-bold text-emerald-800 uppercase tracking-wider whitespace-nowrap">
                    Tổng cộng
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((r) => (
                  <tr key={r.roomId} className="group">
                    <th scope="row" className={`${stickyCol} bg-white group-hover:bg-slate-50 border-b border-r border-slate-100 px-4 py-2 text-left font-bold text-slate-800 whitespace-nowrap`}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${r.roomClass === "signature" ? "bg-purple-500" : "bg-sky-500"}`} />
                        {r.roomNumber}
                      </span>
                    </th>
                    {r.values.map((v, i) => (
                      <td
                        key={data.months[i]}
                        style={{ backgroundColor: shade(v) }}
                        className={`border-b border-slate-100 px-4 py-2 text-right whitespace-nowrap ${v === 0 ? "text-slate-300" : "text-slate-800"}`}
                      >
                        {cellMoney(v)}
                      </td>
                    ))}
                    <td className="border-b border-l border-slate-200 bg-emerald-50/60 px-4 py-2 text-right font-bold text-emerald-900 whitespace-nowrap">
                      {cellMoney(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {data.retained && (
                  <tr>
                    <th className={`${stickyCol} bg-amber-50 border-t border-r border-amber-200 px-4 py-2 text-left text-xs font-bold text-amber-800 whitespace-nowrap`}>
                      Thu giữ từ huỷ / No-show
                    </th>
                    {data.retained.columnTotals.map((v, i) => (
                      <td key={data.months[i]} className={`bg-amber-50 border-t border-amber-200 px-4 py-2 text-right whitespace-nowrap ${v === 0 ? "text-amber-300" : "font-semibold text-amber-900"}`}>
                        {cellMoney(v)}
                      </td>
                    ))}
                    <td className="bg-amber-100 border-t border-l border-amber-200 px-4 py-2 text-right font-bold text-amber-900 whitespace-nowrap">
                      {cellMoney(data.retained.grandTotal)}
                    </td>
                  </tr>
                )}
                <tr>
                  <th className={`${stickyCol} bottom-0 z-30 bg-slate-100 border-t-2 border-r border-slate-300 px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider`}>
                    Tổng cộng
                  </th>
                  {data.columnTotals.map((v, i) => (
                    <td key={data.months[i]} className="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 px-4 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {cellMoney(v)}
                    </td>
                  ))}
                  <td className="sticky bottom-0 z-20 bg-emerald-600 border-t-2 border-l border-emerald-700 px-4 py-2.5 text-right font-bold text-white whitespace-nowrap">
                    {formatMoney(data.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
          {loading && data && <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500/70 animate-pulse z-40" />}
        </div>
      </div>
    </AdminShell>
  );
}
