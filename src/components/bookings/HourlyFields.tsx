"use client";

import React, { useMemo } from "react";
import { resolveHourlyCombo } from "@/lib/pricing";

interface HourlyFieldsProps {
  checkinDate: string; // YYYY-MM-DD
  checkinHour: number; // 9 to 21
  durationHours: number; // 3 to 12
  onChangeDate: (date: string) => void;
  onChangeHour: (hour: number) => void;
  onChangeDuration: (duration: number) => void;
}

export const HourlyFields: React.FC<HourlyFieldsProps> = ({
  checkinDate,
  checkinHour,
  durationHours,
  onChangeDate,
  onChangeHour,
  onChangeDuration,
}) => {
  // Allowed check-in hours: 9h to 21h
  const checkinHoursList = Array.from({ length: 13 }).map((_, i) => i + 9);

  // Durations from 3h to 10h
  const durationOptions = [3, 4, 5, 6, 7, 8, 9, 10];

  const comboInfo = useMemo(() => {
    return resolveHourlyCombo(durationHours);
  }, [durationHours]);

  // Compute checkout time
  const calculatedCheckout = useMemo(() => {
    const d = new Date(`${checkinDate}T00:00:00`);
    d.setHours(checkinHour + durationHours, 0, 0, 0);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  }, [checkinDate, checkinHour, durationHours]);

  return (
    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>⏱️</span> Quy tắc đặt theo giờ (Combo 3h & 6h)
        </span>
        <span className="text-[11px] text-slate-400">Khung giờ nhận: 9:00 - 21:00</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Ngày nhận phòng
          </label>
          <input
            type="date"
            value={checkinDate}
            onChange={(e) => e.target.value && onChangeDate(e.target.value)}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Check-in Hour */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Giờ nhận phòng
          </label>
          <select
            value={checkinHour}
            onChange={(e) => onChangeHour(Number(e.target.value))}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            {checkinHoursList.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>

        {/* Duration Hours */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Thời lượng lưu trú
          </label>
          <select
            value={durationHours}
            onChange={(e) => onChangeDuration(Number(e.target.value))}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold text-emerald-300"
          >
            {durationOptions.map((hours) => {
              const info = resolveHourlyCombo(hours);
              const label =
                info.extraHours > 0
                  ? `${hours} Giờ (${info.comboLabel} + ${info.extraHours}h)`
                  : `${hours} Giờ (${info.comboLabel})`;
              return (
                <option key={hours} value={hours}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Formula & Checkout preview */}
      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-slate-300">
          <span className="text-slate-400">Công thức tính: </span>
          <strong className="text-emerald-400">{comboInfo.comboLabel}</strong>
          {comboInfo.extraHours > 0 && (
            <span className="text-amber-300 font-medium">
              {" "}
              + {comboInfo.extraHours} giờ phụ trội (+
              {Number(comboInfo.extraHours * 60000).toLocaleString("vi-VN")}đ)
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-slate-400">Trả phòng lúc: </span>
          <strong className="text-white font-mono">{calculatedCheckout}</strong>
        </div>
      </div>
    </div>
  );
};
