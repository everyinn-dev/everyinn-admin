"use client";

import React, { useMemo } from "react";
import { Input } from "../ui/Input";

interface DepositSectionProps {
  isDeposit: boolean;
  onToggleDeposit: (enabled: boolean) => void;
  depositAmount: number;
  onChangeDepositAmount: (amount: number) => void;
  depositDueDate: string;
  onChangeDepositDueDate: (date: string) => void;
  totalPrice: number;
  checkinDateStr: string; // 'YYYY-MM-DD'
}

export const DepositSection: React.FC<DepositSectionProps> = ({
  isDeposit,
  onToggleDeposit,
  depositAmount,
  onChangeDepositAmount,
  depositDueDate,
  onChangeDepositDueDate,
  totalPrice,
  checkinDateStr,
}) => {
  // Today in Vietnam (UTC+7)
  const todayStr = useMemo(() => {
    return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  }, []);

  // Compute 1 day before checkin
  const dayBeforeCheckinStr = useMemo(() => {
    try {
      const d = new Date(`${checkinDateStr}T00:00:00`);
      d.setDate(d.getDate() - 1);
      const iso = d.toISOString().slice(0, 10);
      return iso < todayStr ? todayStr : iso;
    } catch {
      return todayStr;
    }
  }, [checkinDateStr, todayStr]);

  const remainingAmount = Math.max(0, totalPrice - depositAmount);

  // Quick preset handlers
  const handleSetPreset50 = () => {
    const val = Math.round((totalPrice * 0.5) / 1000) * 1000;
    onChangeDepositAmount(val);
  };

  const handleSetPreset30 = () => {
    const val = Math.round((totalPrice * 0.3) / 1000) * 1000;
    onChangeDepositAmount(val);
  };

  return (
    <div className="rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs bg-white border-slate-200">
      {/* Header with Switch */}
      <div className="p-4 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-50/70 to-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center text-sm font-bold shadow-xs">
            🔒
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 block leading-tight">
              Khách Đặt Cọc Giữ Phòng
            </span>
            <span className="text-[11px] text-slate-500">
              Thu trước một phần tiền (mặc định 50%) và hẹn ngày thu phần còn lại
            </span>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => {
            const nextState = !isDeposit;
            onToggleDeposit(nextState);
            if (nextState) {
              // Default to 50%
              const defaultVal = Math.round((totalPrice * 0.5) / 1000) * 1000;
              onChangeDepositAmount(defaultVal);
              // Default due date to day before checkin or checkin
              onChangeDepositDueDate(dayBeforeCheckinStr);
            }
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isDeposit ? "bg-amber-600" : "bg-slate-300 hover:bg-slate-400"
          }`}
          role="switch"
          aria-checked={isDeposit}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isDeposit ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Expanded Deposit Configuration Form */}
      {isDeposit && (
        <div className="p-4.5 space-y-4 bg-white animate-in fade-in duration-150">
          {/* Preset Buttons & Deposit Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Số tiền đặt cọc (Thu ngay khi chốt) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSetPreset50}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors shadow-xs"
                >
                  50% ({((totalPrice * 0.5) / 1000).toFixed(0)}k)
                </button>
                <button
                  type="button"
                  onClick={handleSetPreset30}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors shadow-xs"
                >
                  30% ({((totalPrice * 0.3) / 1000).toFixed(0)}k)
                </button>
              </div>
            </div>

            <div className="relative">
              <Input
                type="number"
                min={0}
                max={totalPrice}
                step="any"
                value={depositAmount || ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChangeDepositAmount(isNaN(val) ? 0 : Math.min(val, totalPrice));
                }}
                placeholder="Nhập số tiền khách cọc..."
                hint={`Đã cọc: ${depositAmount.toLocaleString("vi-VN")} đ · Còn lại phải thu sau: ${remainingAmount.toLocaleString("vi-VN")} đ`}
              />
            </div>
          </div>

          {/* Quick Summary Chips */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 block font-medium">Tiền cọc thu ngay:</span>
              <span className="font-mono font-extrabold text-amber-900 text-sm">
                {depositAmount.toLocaleString("vi-VN")} đ
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block font-medium">Còn thiếu thu sau:</span>
              <span className="font-mono font-extrabold text-slate-900 text-sm">
                {remainingAmount.toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>

          {/* Due Date for Remaining Payment */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Hạn thanh toán số tiền còn lại <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => onChangeDepositDueDate(dayBeforeCheckinStr)}
                  className={`px-2 py-0.5 rounded-lg border font-semibold transition-colors ${
                    depositDueDate === dayBeforeCheckinStr
                      ? "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                      : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                  }`}
                >
                  Trước 1 ngày
                </button>
                <button
                  type="button"
                  onClick={() => onChangeDepositDueDate(checkinDateStr)}
                  className={`px-2 py-0.5 rounded-lg border font-semibold transition-colors ${
                    depositDueDate === checkinDateStr
                      ? "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                      : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                  }`}
                >
                  Ngày check-in
                </button>
              </div>
            </div>

            <input
              type="date"
              min={todayStr}
              value={depositDueDate}
              onChange={(e) => onChangeDepositDueDate(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-amber-600 shadow-xs cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 italic">
              🔔 Vào ngày này, hệ thống sẽ tự động hiển thị popup giữa màn hình nhắc nhở toàn bộ nhân viên online thu nốt {remainingAmount.toLocaleString("vi-VN")} đ.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
