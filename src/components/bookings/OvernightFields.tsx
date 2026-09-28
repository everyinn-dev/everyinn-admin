"use client";

import React, { useMemo } from "react";

interface OvernightFieldsProps {
  checkinDate: string; // YYYY-MM-DD
  startHour: number; // 21, 22, 23, 24
  lateCheckoutHours: number; // 0 to 6
  hourlySlots?: number[];
  extraHourFee?: number;
  maxLateCheckoutHours?: number;
  onChangeDate: (date: string) => void;
  onChangeStartHour: (hour: number) => void;
  onChangeLateCheckout: (lateHours: number) => void;
}

export const OvernightFields: React.FC<OvernightFieldsProps> = ({
  checkinDate,
  startHour,
  lateCheckoutHours,
  hourlySlots,
  extraHourFee = 60000,
  maxLateCheckoutHours = 2,
  onChangeDate,
  onChangeStartHour,
  onChangeLateCheckout,
}) => {
  const slots = hourlySlots && hourlySlots.length > 0 ? hourlySlots : [21, 22, 23, 24];
  const unitFee = extraHourFee;
  const maxLate = maxLateCheckoutHours;

  // Allowed overnight checkin options generated dynamically from master data
  const startHourOptions = useMemo(() => {
    return slots.map((hour) => {
      const checkoutHour = (hour + 12) % 24;
      const checkoutStr = checkoutHour < 10 ? `0${checkoutHour}:00` : `${checkoutHour}:00`;
      const hourStr = hour === 24 ? "24:00 / 00:00" : `${hour}:00 tối`;
      return {
        value: hour,
        label: `${hourStr} (Trả ${checkoutStr} hôm sau)`,
      };
    });
  }, [slots]);

  // Late checkout options dynamically generated based on maxLateCheckoutHours
  const lateCheckoutOptions = useMemo(() => {
    return Array.from({ length: maxLate + 1 }, (_, i) => i);
  }, [maxLate]);

  // Calculated checkout date & time
  const calculatedCheckout = useMemo(() => {
    const d = new Date(`${checkinDate}T00:00:00`);
    // Add start hour + 12 hours basic stay + late checkout hours
    d.setHours(startHour + 12 + lateCheckoutHours, 0, 0, 0);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  }, [checkinDate, startHour, lateCheckoutHours]);

  const minSlot = Math.min(...slots);
  const maxSlot = Math.max(...slots);

  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
          <span>🌙</span> Quy tắc đặt qua đêm (12 tiếng trọn đêm)
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          Khung giờ nhận: {minSlot}:00 - {maxSlot}:00
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Đêm ngày
          </label>
          <input
            type="date"
            value={checkinDate}
            onChange={(e) => e.target.value && onChangeDate(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 shadow-xs"
          />
        </div>

        {/* Start Hour */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Giờ nhận phòng
          </label>
          <select
            value={startHour}
            onChange={(e) => onChangeStartHour(Number(e.target.value))}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 font-semibold shadow-xs"
          >
            {startHourOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Late Checkout Hours */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Trả phòng trễ (Late Checkout)
          </label>
          <select
            value={lateCheckoutHours}
            onChange={(e) => onChangeLateCheckout(Number(e.target.value))}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-indigo-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 font-bold shadow-xs"
          >
            {lateCheckoutOptions.map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "Đúng giờ (0h)" : `+${h} giờ trễ (+${(h * unitFee).toLocaleString("vi-VN")}đ)`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary preview */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
        <div className="text-slate-600">
          <span className="text-slate-500 font-medium">Thời lượng: </span>
          <strong className="text-indigo-800 font-bold">12 Giờ tiêu chuẩn</strong>
          {lateCheckoutHours > 0 && (
            <span className="text-amber-800 font-semibold">
              {" "}
              + {lateCheckoutHours} giờ trễ (+
              {Number(lateCheckoutHours * unitFee).toLocaleString("vi-VN")}đ)
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
