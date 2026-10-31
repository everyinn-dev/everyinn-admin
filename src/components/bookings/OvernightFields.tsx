"use client";

import React from "react";
import { OVERNIGHT_START_HOURS } from "@/lib/pricing";

interface OvernightFieldsProps {
  checkinDate: string;
  startHour: number; // 21, 22, 23, 24
  earlyCheckinHours?: number;
  lateCheckoutHours: number;
  onChangeDate: (date: string) => void;
  onChangeStartHour: (hour: number) => void;
  onChangeEarlyCheckin?: (hours: number) => void;
  onChangeLateCheckout: (hours: number) => void;
}

export const OvernightFields: React.FC<OvernightFieldsProps> = ({
  checkinDate,
  startHour,
  earlyCheckinHours = 0,
  lateCheckoutHours,
  onChangeDate,
  onChangeStartHour,
  onChangeEarlyCheckin,
  onChangeLateCheckout,
}) => {
  // Ca gốc: startHour (21, 22, 23, 24) -> giờ checkout chuẩn sáng hôm sau = startHour - 12 (9, 10, 11, 12)
  const standardCheckoutHour = startHour - 12;
  // Giờ check-in thực tế: không được sớm hơn 21:00
  const maxEarlyHours = Math.max(0, startHour - 21);
  const clampedEarly = Math.min(maxEarlyHours, Math.max(0, earlyCheckinHours));
  const actualCheckinHour = startHour - clampedEarly;
  const actualCheckoutHour = standardCheckoutHour + lateCheckoutHours;

  // Danh sách giờ nhận phòng thực tế hợp lệ (từ 21:00 đến startHour)
  const availableActualCheckinHours: number[] = [];
  for (let h = 21; h <= startHour; h++) {
    availableActualCheckinHours.push(h);
  }

  // Danh sách giờ trả phòng thực tế hợp lệ (từ standardCheckoutHour đến +6h)
  const availableActualCheckoutHours: number[] = [];
  for (let h = standardCheckoutHour; h <= standardCheckoutHour + 6; h++) {
    availableActualCheckoutHours.push(h);
  }

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
          🌙 Đặt phòng Qua Đêm (Gói chuẩn 12 giờ, nhận phòng từ 21:00)
        </span>
        <span className="text-xs text-slate-600">
          Lịch thực tế:{" "}
          <strong className="text-indigo-950 font-mono">
            {actualCheckinHour === 24 ? "00:00 (Đêm)" : `${String(actualCheckinHour).padStart(2, "0")}:00`} →{" "}
            {String(actualCheckoutHour).padStart(2, "0")}:00 hôm sau
          </strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Stay Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Ngày đêm lưu trú
          </label>
          <input
            type="date"
            value={checkinDate}
            onChange={(e) => onChangeDate(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
          />
        </div>

        {/* Base Shift */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Ca qua đêm chuẩn (12h)
          </label>
          <select
            value={startHour}
            onChange={(e) => {
              const newShift = Number(e.target.value);
              onChangeStartHour(newShift);
              // Đảm bảo earlyCheckinHours không vượt quá (newShift - 21)
              if (onChangeEarlyCheckin && earlyCheckinHours > newShift - 21) {
                onChangeEarlyCheckin(Math.max(0, newShift - 21));
              }
            }}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
          >
            {OVERNIGHT_START_HOURS.map((item) => (
              <option key={item.hour} value={item.hour}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* Receptionist-First: Giờ Check-in thực tế */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Giờ khách vào thực tế
          </label>
          <select
            value={actualCheckinHour}
            onChange={(e) => {
              const chosenActualHour = Number(e.target.value);
              const derivedEarly = Math.max(0, startHour - chosenActualHour);
              onChangeEarlyCheckin?.(derivedEarly);
            }}
            disabled={!onChangeEarlyCheckin || startHour === 21}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs disabled:bg-slate-100"
          >
            {availableActualCheckinHours.map((h) => {
              const earlyDiff = startHour - h;
              const hLabel = h === 24 ? "00:00 (24h)" : `${String(h).padStart(2, "0")}:00`;
              return (
                <option key={h} value={h}>
                  {earlyDiff === 0
                    ? `${hLabel} (Đúng giờ ca)`
                    : `${hLabel} (Sớm +${earlyDiff}h = +${(earlyDiff * 60).toLocaleString("vi-VN")}k)`}
                </option>
              );
            })}
          </select>
        </div>

        {/* Receptionist-First: Giờ Check-out thực tế */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Giờ khách ra sáng hôm sau
          </label>
          <select
            value={actualCheckoutHour}
            onChange={(e) => {
              const chosenOutHour = Number(e.target.value);
              const derivedLate = Math.max(0, chosenOutHour - standardCheckoutHour);
              onChangeLateCheckout(derivedLate);
            }}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
          >
            {availableActualCheckoutHours.map((h) => {
              const lateDiff = h - standardCheckoutHour;
              return (
                <option key={h} value={h}>
                  {lateDiff === 0
                    ? `${String(h).padStart(2, "0")}:00 (Đúng giờ ca)`
                    : `${String(h).padStart(2, "0")}:00 (Muộn +${lateDiff}h = +${(lateDiff * 60).toLocaleString("vi-VN")}k)`}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Auto-derived summary badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-indigo-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 font-semibold">
            Ca gốc: {startHour === 24 ? "00:00" : `${startHour}:00`} → {String(standardCheckoutHour).padStart(2, "0")}:00 (12h)
          </span>
          {clampedEarly > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold">
              ⚡ Hệ thống tự tính: Nhận sớm +{clampedEarly}h (+{(clampedEarly * 60000).toLocaleString("vi-VN")}đ)
            </span>
          )}
          {lateCheckoutHours > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold">
              ⏰ Hệ thống tự tính: Trả muộn +{lateCheckoutHours}h (+{(lateCheckoutHours * 60000).toLocaleString("vi-VN")}đ)
            </span>
          )}
        </div>
        {startHour === 24 && (
          <span className="text-[11px] font-semibold text-indigo-700">
            📌 Ca 00:00–12:00 thuộc quỹ phòng đêm ngày {checkinDate || "đã chọn"}.
          </span>
        )}
      </div>
    </div>
  );
};
