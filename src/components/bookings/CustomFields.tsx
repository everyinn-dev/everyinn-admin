"use client";

import React from "react";
import { Input } from "../ui/Input";

interface CustomFieldsProps {
  checkinDate: string;
  checkinTime: string; // HH:mm
  checkoutDate: string;
  checkoutTime: string; // HH:mm
  customPrice: number;
  onChangeCheckinDate: (date: string) => void;
  onChangeCheckinTime: (time: string) => void;
  onChangeCheckoutDate: (date: string) => void;
  onChangeCheckoutTime: (time: string) => void;
  onChangeCustomPrice: (price: number) => void;
}

export const CustomFields: React.FC<CustomFieldsProps> = ({
  checkinDate,
  checkinTime,
  checkoutDate,
  checkoutTime,
  customPrice,
  onChangeCheckinDate,
  onChangeCheckinTime,
  onChangeCheckoutDate,
  onChangeCheckoutTime,
  onChangeCustomPrice,
}) => {
  // Compute duration
  const inDate = new Date(`${checkinDate}T${checkinTime}:00`);
  const outDate = new Date(`${checkoutDate}T${checkoutTime}:00`);
  const diffMs = outDate.getTime() - inDate.getTime();
  const validDiff = !isNaN(diffMs) && diffMs > 0;
  const totalHours = validDiff ? Math.round(diffMs / (3600 * 1000)) : 0;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  const durationStr = validDiff
    ? days > 0
      ? `${days} ngày${hours > 0 ? ` ${hours} giờ` : ""}`
      : `${totalHours} giờ`
    : "Thời gian không hợp lệ";

  return (
    <div className="space-y-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚙️</span>
          <span className="text-xs font-bold text-fuchsia-300 uppercase tracking-wide">
            Cấu hình đơn đặt phòng Tuỳ Chỉnh
          </span>
        </div>
        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
          Thời lượng: {durationStr}
        </span>
      </div>

      {/* Grid checkin - checkout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Checkin Group */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <span>📥</span>
            <span>Thời gian Nhận phòng (Check-in)</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Ngày nhận"
              type="date"
              value={checkinDate}
              onChange={(e) => e.target.value && onChangeCheckinDate(e.target.value)}
            />
            <Input
              label="Giờ nhận"
              type="time"
              value={checkinTime}
              onChange={(e) => e.target.value && onChangeCheckinTime(e.target.value)}
            />
          </div>
        </div>

        {/* Checkout Group */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <span>📤</span>
            <span>Thời gian Trả phòng (Check-out)</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Ngày trả"
              type="date"
              value={checkoutDate}
              onChange={(e) => e.target.value && onChangeCheckoutDate(e.target.value)}
            />
            <Input
              label="Giờ trả"
              type="time"
              value={checkoutTime}
              onChange={(e) => e.target.value && onChangeCheckoutTime(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Custom Price Input */}
      <div className="p-3 rounded-xl bg-fuchsia-950/20 border border-fuchsia-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <span>💰</span>
            <span>Số tiền thanh toán thỏa thuận (VNĐ)</span>
            <span className="text-rose-400">*</span>
          </label>
          <span className="text-xs font-mono font-extrabold text-fuchsia-300">
            {customPrice > 0 ? `${customPrice.toLocaleString("vi-VN")} đ` : "0 đ"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="number"
              min="0"
              step="10000"
              placeholder="Nhập số tiền thỏa thuận (VD: 800000, 1500000...)"
              value={customPrice === 0 ? "" : customPrice}
              onChange={(e) => onChangeCustomPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full rounded-xl bg-[#131b28] border border-fuchsia-500/40 px-3.5 py-2.5 text-base font-mono font-bold text-emerald-300 focus:outline-none focus:border-fuchsia-400 shadow-inner"
            />
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
            {[400000, 600000, 800000, 1000000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChangeCustomPrice(preset)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 hover:text-white transition-colors border border-slate-700 active:scale-95"
              >
                {preset / 1000}k
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          💡 Với đơn tuỳ chỉnh, số tiền trên sẽ được khóa làm tổng tiền thanh toán trực tiếp của đơn đặt.
        </p>
      </div>
    </div>
  );
};
