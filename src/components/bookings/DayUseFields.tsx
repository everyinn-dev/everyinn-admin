"use client";

import React, { useMemo } from "react";

interface DayUseFieldsProps {
  checkinDate: string; // YYYY-MM-DD
  nights: number; // 1 to 14
  lateCheckoutHours: number; // 0 to 6
  onChangeDate: (date: string) => void;
  onChangeNights: (nights: number) => void;
  onChangeLateCheckout: (lateHours: number) => void;
}

export const DayUseFields: React.FC<DayUseFieldsProps> = ({
  checkinDate,
  nights,
  lateCheckoutHours,
  onChangeDate,
  onChangeNights,
  onChangeLateCheckout,
}) => {
  const nightOptions = Array.from({ length: 14 }).map((_, i) => i + 1);
  const lateCheckoutOptions = [0, 1, 2, 3, 4, 5, 6];

  const calculatedCheckout = useMemo(() => {
    const d = new Date(`${checkinDate}T15:00:00`);
    d.setDate(d.getDate() + nights);
    d.setHours(12 + lateCheckoutHours, 0, 0, 0);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [checkinDate, nights, lateCheckoutHours]);

  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
          <span>📅</span> Quy tắc đặt theo ngày (Checkin 15:00 - Checkout 12:00)
        </span>
        <span className="text-[11px] text-slate-500 font-medium">Tối đa trễ 6 tiếng</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Ngày nhận phòng (Check-in 15:00)
          </label>
          <input
            type="date"
            value={checkinDate}
            onChange={(e) => e.target.value && onChangeDate(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 shadow-xs"
          />
        </div>

        {/* Nights */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Số đêm lưu trú
          </label>
          <select
            value={nights}
            onChange={(e) => onChangeNights(Number(e.target.value))}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-amber-900 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 font-bold shadow-xs"
          >
            {nightOptions.map((n) => (
              <option key={n} value={n}>
                {n} đêm ({n} ngày)
              </option>
            ))}
          </select>
        </div>

        {/* Late Checkout */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Trả phòng trễ (Sau 12:00)
          </label>
          <select
            value={lateCheckoutHours}
            onChange={(e) => onChangeLateCheckout(Number(e.target.value))}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 font-semibold shadow-xs"
          >
            {lateCheckoutOptions.map((h) => (
              <option key={h} value={h}>
                {h === 0
                  ? "Đúng giờ 12:00 (0h)"
                  : `+${h} giờ trễ (${12 + h}:00) (+${(h * 60000).toLocaleString("vi-VN")}đ)`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary preview */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
        <div className="text-slate-600">
          <span className="text-slate-500 font-medium">Thời lượng: </span>
          <strong className="text-amber-800 font-bold">{nights} Đêm</strong>
          {lateCheckoutHours > 0 && (
            <span className="text-amber-800 font-semibold">
              {" "}
              + {lateCheckoutHours} giờ trễ (+
              {Number(lateCheckoutHours * 60000).toLocaleString("vi-VN")}đ)
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-slate-500 font-medium">Trả phòng dự kiến: </span>
          <strong className="text-slate-900 font-mono font-bold">{calculatedCheckout}</strong>
        </div>
      </div>
    </div>
  );
};
