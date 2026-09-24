"use client";

import React, { useMemo } from "react";

interface OvernightFieldsProps {
  checkinDate: string; // YYYY-MM-DD
  startHour: number; // 21, 22, 23, 24
  lateCheckoutHours: number; // 0 to 6
  onChangeDate: (date: string) => void;
  onChangeStartHour: (hour: number) => void;
  onChangeLateCheckout: (lateHours: number) => void;
}

export const OvernightFields: React.FC<OvernightFieldsProps> = ({
  checkinDate,
  startHour,
  lateCheckoutHours,
  onChangeDate,
  onChangeStartHour,
  onChangeLateCheckout,
}) => {
  // Allowed overnight checkin options: 21h, 22h, 23h, 24h (0h)
  const startHourOptions = [
    { value: 21, label: "21:00 tối (Trả 09:00 hôm sau)" },
    { value: 22, label: "22:00 tối (Trả 10:00 hôm sau)" },
    { value: 23, label: "23:00 tối (Trả 11:00 hôm sau)" },
    { value: 24, label: "24:00 / 00:00 (Trả 12:00 hôm sau)" },
  ];

  // Late checkout options (0h to 2h, each +60k - max 2h per policy)
  const lateCheckoutOptions = [0, 1, 2];

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

  return (
    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>🌙</span> Quy tắc đặt qua đêm (12 tiếng trọn đêm)
        </span>
        <span className="text-[11px] text-slate-400">Khung giờ nhận: 21:00 - 24:00</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Đêm ngày
          </label>
          <input
            type="date"
            value={checkinDate}
            onChange={(e) => e.target.value && onChangeDate(e.target.value)}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Start Hour */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Giờ nhận phòng
          </label>
          <select
            value={startHour}
            onChange={(e) => onChangeStartHour(Number(e.target.value))}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
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
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Trả phòng trễ (Late Checkout)
          </label>
          <select
            value={lateCheckoutHours}
            onChange={(e) => onChangeLateCheckout(Number(e.target.value))}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-semibold text-indigo-300"
          >
            {lateCheckoutOptions.map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "Đúng giờ (0h)" : `+${h} giờ trễ (+${(h * 60000).toLocaleString("vi-VN")}đ)`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary preview */}
      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-slate-300">
          <span className="text-slate-400">Thời lượng: </span>
          <strong className="text-indigo-400">12 Giờ tiêu chuẩn</strong>
          {lateCheckoutHours > 0 && (
            <span className="text-amber-300 font-medium">
              {" "}
              + {lateCheckoutHours} giờ trễ (+
              {Number(lateCheckoutHours * 60000).toLocaleString("vi-VN")}đ)
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-slate-400">Trả phòng dự kiến: </span>
          <strong className="text-white font-mono">{calculatedCheckout}</strong>
        </div>
      </div>
    </div>
  );
};
