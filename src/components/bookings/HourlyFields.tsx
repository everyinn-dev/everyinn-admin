"use client";

import React from "react";
import { CappingWarning } from "@/types";
import { DEFAULT_HOURLY_SLOTS } from "@/lib/pricing";

interface HourlyFieldsProps {
  checkinDate: string; // YYYY-MM-DD
  checkinHour: number;
  durationHours: number;
  hourlySlots?: number[];
  cappingWarning?: CappingWarning | null;
  onSwitchBookingType?: (targetType: "overnight" | "dayuse") => void;
  onChangeDate: (date: string) => void;
  onChangeHour: (hour: number) => void;
  onChangeDuration: (duration: number) => void;
}

const DURATION_OPTIONS = [3, 4, 5, 6, 7, 8];

export const HourlyFields: React.FC<HourlyFieldsProps> = ({
  checkinDate,
  checkinHour,
  durationHours,
  hourlySlots = DEFAULT_HOURLY_SLOTS,
  cappingWarning,
  onSwitchBookingType,
  onChangeDate,
  onChangeHour,
  onChangeDuration,
}) => {
  const checkoutHour = checkinHour + durationHours;
  const isNextDay = checkoutHour >= 24;
  const displayCheckoutHour = isNextDay ? checkoutHour - 24 : checkoutHour;

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-slate-100/80 border border-slate-200/80">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
          ⏱️ Đặt phòng Theo Giờ (Combo khởi điểm 3 giờ, nhận phòng 08:00 – 21:00)
        </span>
        <span className="text-xs text-slate-600">
          Trả phòng dự kiến:{" "}
          <strong className="text-slate-900 font-mono">
            {String(displayCheckoutHour).padStart(2, "0")}:00{" "}
            {isNextDay ? "(Hôm sau)" : "(Cùng ngày)"}
          </strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Check-in Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Ngày nhận phòng
          </label>
          <input
            type="date"
            value={checkinDate}
            onChange={(e) => onChangeDate(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs"
          />
        </div>

        {/* Check-in Hour (8h -> 21h) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Giờ Check-in (08:00 – 21:00)
          </label>
          <select
            value={checkinHour}
            onChange={(e) => onChangeHour(Number(e.target.value))}
            className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs"
          >
            {hourlySlots.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>

        {/* Duration (min 3h) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Thời lượng lưu trú
          </label>
          <select
            value={durationHours}
            onChange={(e) => onChangeDuration(Number(e.target.value))}
            className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d === 3 ? "3 giờ (Combo chuẩn)" : `${d} giờ (Combo 3h + ${d - 3}h thêm)`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Soft Capping Advisory Banner */}
      {(cappingWarning?.exceeded || cappingWarning?.exceedsThreshold) && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2 text-xs text-amber-950">
            <span className="text-base shrink-0">💡</span>
            <div>
              <span className="font-extrabold block text-amber-900">
                Gợi ý tối ưu gói giá cho khách (Capping Advisory):
              </span>
              <span>{cappingWarning.message}</span>
            </div>
          </div>
          {onSwitchBookingType && cappingWarning.suggestedBookingType && (
            <button
              type="button"
              onClick={() => cappingWarning.suggestedBookingType && onSwitchBookingType(cappingWarning.suggestedBookingType)}
              className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shrink-0 cursor-pointer shadow-xs"
            >
              Chuyển sang {cappingWarning.suggestedBookingType === "overnight" ? "Qua Đêm" : "Theo Ngày"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
