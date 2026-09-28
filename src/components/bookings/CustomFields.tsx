"use client";

import React, { useMemo } from "react";
import { Input } from "../ui/Input";
import {
  TIME_SLOTS_30MIN,
  getVnToday,
  isPastTimeSlot,
  roundToNearest30Min,
  timeStrToMinutes,
} from "@/lib/timelineUtils";

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
  const todayStr = useMemo(() => getVnToday(), []);

  // Standardize times to 30-minute steps
  const normalizedCheckinTime = roundToNearest30Min(checkinTime || "14:00");
  const normalizedCheckoutTime = roundToNearest30Min(checkoutTime || "12:00");

  // Compute duration
  const inDate = new Date(`${checkinDate}T${normalizedCheckinTime}:00`);
  const outDate = new Date(`${checkoutDate}T${normalizedCheckoutTime}:00`);
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
    <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚙️</span>
          <span className="text-xs font-bold text-fuchsia-900 uppercase tracking-wide">
            Cấu hình đơn đặt phòng Tuỳ Chỉnh (Bước 30 phút)
          </span>
        </div>
        <span
          className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
            validDiff
              ? "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300"
              : "bg-rose-100 text-rose-900 border-rose-300"
          }`}
        >
          Thời lượng: {durationStr}
        </span>
      </div>

      {/* Grid checkin - checkout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Checkin Group */}
        <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="text-xs font-bold text-emerald-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>📥</span>
              <span>Thời gian Nhận phòng (Check-in)</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Bước 30m</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Ngày nhận"
              type="date"
              value={checkinDate}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                onChangeCheckinDate(val);
                if (checkoutDate < val) {
                  onChangeCheckoutDate(val);
                }
              }}
            />
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Giờ nhận (30m)
              </label>
              <select
                value={normalizedCheckinTime}
                onChange={(e) => onChangeCheckinTime(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs"
              >
                {TIME_SLOTS_30MIN.map((slot) => {
                  const isPast = isPastTimeSlot(checkinDate, slot);
                  return (
                    <option
                      key={slot}
                      value={slot}
                      disabled={isPast}
                      className={
                        isPast
                          ? "text-slate-400 bg-slate-100 font-normal"
                          : "text-slate-900 bg-white font-semibold"
                      }
                    >
                      {slot} {isPast ? "(Đã qua)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Checkout Group */}
        <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="text-xs font-bold text-amber-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>📤</span>
              <span>Thời gian Trả phòng (Check-out)</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Bước 30m</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Ngày trả"
              type="date"
              min={checkinDate || todayStr}
              value={checkoutDate}
              onChange={(e) => e.target.value && onChangeCheckoutDate(e.target.value)}
            />
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Giờ trả (30m)
              </label>
              <select
                value={normalizedCheckoutTime}
                onChange={(e) => onChangeCheckoutTime(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono font-semibold focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 shadow-xs"
              >
                {TIME_SLOTS_30MIN.map((slot) => {
                  const isPast = isPastTimeSlot(checkoutDate, slot);
                  const isBeforeOrEqualIn =
                    checkoutDate === checkinDate &&
                    timeStrToMinutes(slot) <= timeStrToMinutes(normalizedCheckinTime);
                  const isSlotDisabled = isPast || isBeforeOrEqualIn;

                  return (
                    <option
                      key={slot}
                      value={slot}
                      disabled={isSlotDisabled}
                      className={
                        isSlotDisabled
                          ? "text-slate-400 bg-slate-100 font-normal"
                          : "text-slate-900 bg-white font-semibold"
                      }
                    >
                      {slot} {isPast ? "(Đã qua)" : isBeforeOrEqualIn ? "(Trước giờ nhận)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Price Input */}
      <div className="p-3.5 rounded-xl bg-fuchsia-50/70 border border-fuchsia-200 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <span>💰</span>
            <span>Số tiền thanh toán thỏa thuận (VNĐ)</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-xs font-mono font-extrabold text-fuchsia-900">
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
              className="w-full rounded-xl bg-white border border-fuchsia-300 px-3.5 py-2.5 text-base font-mono font-bold text-emerald-800 focus:outline-none focus:border-fuchsia-600 focus:ring-2 focus:ring-fuchsia-600/20 shadow-xs"
            />
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
            {[400000, 600000, 800000, 1000000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChangeCustomPrice(preset)}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-[11px] font-mono font-bold text-slate-700 transition-colors border border-slate-300 active:scale-95 shadow-xs"
              >
                {preset / 1000}k
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-600 font-medium">
          💡 Với đơn tuỳ chỉnh, số tiền trên sẽ được khóa làm tổng tiền thanh toán trực tiếp của đơn đặt.
        </p>
      </div>
    </div>
  );
};
