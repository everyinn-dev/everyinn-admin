"use client";

import React from "react";

interface DayUseFieldsProps {
  checkinDate: string;
  nights: number;
  earlyCheckinHours?: number;
  lateCheckoutHours: number;
  onChangeDate: (date: string) => void;
  onChangeNights: (nights: number) => void;
  onChangeEarlyCheckin?: (hours: number) => void;
  onChangeLateCheckout: (hours: number) => void;
  onSwitchToCustom?: () => void;
}

const NIGHT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 10, 14];
// Giờ check-in chuẩn là 15:00 -> cho phép chọn giờ vào thực tế từ 06:00 đến 15:00
const ACTUAL_CHECKIN_HOURS = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6];
// Giờ check-out chuẩn là 12:00 -> cho phép chọn giờ ra thực tế từ 12:00 đến 18:00
const ACTUAL_CHECKOUT_HOURS = [12, 13, 14, 15, 16, 17, 18];

export const DayUseFields: React.FC<DayUseFieldsProps> = ({
  checkinDate,
  nights,
  earlyCheckinHours = 0,
  lateCheckoutHours,
  onChangeDate,
  onChangeNights,
  onChangeEarlyCheckin,
  onChangeLateCheckout,
  onSwitchToCustom,
}) => {
  const actualCheckinHour = Math.max(6, 15 - earlyCheckinHours);
  const actualCheckoutHour = Math.min(20, 12 + lateCheckoutHours);

  const getCheckoutDateDisplay = () => {
    if (!checkinDate) return "";
    const d = new Date(`${checkinDate}T00:00:00`);
    d.setDate(d.getDate() + nights);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
          ☀️ Đặt phòng Theo Ngày (Chuẩn 15:00 nhận – 12:00 trả hôm sau)
        </span>
        <span className="text-xs text-slate-600">
          Lịch thực tế:{" "}
          <strong className="text-amber-950 font-mono">
            {String(actualCheckinHour).padStart(2, "0")}:00 ({checkinDate || "..."}) →{" "}
            {String(actualCheckoutHour).padStart(2, "0")}:00 ({getCheckoutDateDisplay()})
          </strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Check-in Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Ngày nhận phòng
          </label>
          <input
            type="date"
            value={checkinDate}
            onChange={(e) => onChangeDate(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-600 shadow-xs"
          />
        </div>

        {/* Number of Nights */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Số đêm lưu trú
          </label>
          <select
            value={nights}
            onChange={(e) => onChangeNights(Number(e.target.value))}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-600 shadow-xs"
          >
            {NIGHT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} đêm ({n + 1} ngày)
              </option>
            ))}
          </select>
        </div>

        {/* Receptionist-First: Giờ khách vào thực tế */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Giờ khách vào (Chuẩn 15:00)
          </label>
          <select
            value={actualCheckinHour}
            onChange={(e) => {
              const chosenHour = Number(e.target.value);
              const derivedEarly = Math.max(0, 15 - chosenHour);
              onChangeEarlyCheckin?.(derivedEarly);
            }}
            disabled={!onChangeEarlyCheckin}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-600 shadow-xs disabled:bg-slate-100"
          >
            {ACTUAL_CHECKIN_HOURS.map((h) => {
              const earlyDiff = 15 - h;
              return (
                <option key={h} value={h}>
                  {earlyDiff === 0
                    ? "15:00 (Đúng giờ chuẩn)"
                    : `${String(h).padStart(2, "0")}:00 (Sớm +${earlyDiff}h = +${(earlyDiff * 60).toLocaleString("vi-VN")}k)`}
                </option>
              );
            })}
          </select>
        </div>

        {/* Receptionist-First: Giờ khách ra thực tế */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Giờ khách ra (Chuẩn 12:00)
          </label>
          <select
            value={actualCheckoutHour}
            onChange={(e) => {
              const chosenHour = Number(e.target.value);
              const derivedLate = Math.max(0, chosenHour - 12);
              onChangeLateCheckout(derivedLate);
            }}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-600 shadow-xs"
          >
            {ACTUAL_CHECKOUT_HOURS.map((h) => {
              const lateDiff = h - 12;
              return (
                <option key={h} value={h}>
                  {lateDiff === 0
                    ? "12:00 (Đúng giờ chuẩn)"
                    : `${String(h).padStart(2, "0")}:00 (Muộn +${lateDiff}h = +${(lateDiff * 60).toLocaleString("vi-VN")}k)`}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Auto-derived summary & Custom deal shortcut */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {earlyCheckinHours > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold">
              ⚡ Nhận phòng sớm +{earlyCheckinHours}h (+{(earlyCheckinHours * 60000).toLocaleString("vi-VN")}đ)
            </span>
          )}
          {lateCheckoutHours > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold">
              ⏰ Trả phòng muộn +{lateCheckoutHours}h (+{(lateCheckoutHours * 60000).toLocaleString("vi-VN")}đ)
            </span>
          )}
          {earlyCheckinHours === 0 && lateCheckoutHours === 0 && (
            <span className="text-slate-600">
              Đang áp dụng khung giờ chuẩn 15:00 → 12:00 trưa (không phát sinh phụ phí giờ).
            </span>
          )}
        </div>

        {onSwitchToCustom && (
          <button
            type="button"
            onClick={onSwitchToCustom}
            className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
          >
            Khách deal giá trọn gói khác? Chuyển sang Tuỳ chỉnh →
          </button>
        )}
      </div>
    </div>
  );
};
