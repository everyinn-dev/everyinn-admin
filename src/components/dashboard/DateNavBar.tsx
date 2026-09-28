"use client";

import React from "react";
import { Button } from "../ui/Button";
import { getVnToday, getVnCurrentMonth } from "@/lib/timelineUtils";

interface DateNavBarProps {
  viewMode: "month" | "day";
  onViewModeChange: (mode: "month" | "day") => void;
  currentMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  currentDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  onScrollToToday?: () => void;
  roomFilter: "all" | "haven" | "signature";
  onFilterChange: (filter: "all" | "haven" | "signature") => void;
  onRefresh: () => void;
  isLoading?: boolean;
  onOpenRoomLockModal?: () => void;
  roomCounts?: {
    all: number;
    haven: number;
    signature: number;
  };
}

export const DateNavBar: React.FC<DateNavBarProps> = ({
  viewMode,
  onViewModeChange,
  currentMonth,
  onMonthChange,
  currentDate,
  onDateChange,
  onScrollToToday,
  roomFilter,
  onFilterChange,
  onRefresh,
  isLoading = false,
  onOpenRoomLockModal,
  roomCounts,
}) => {
  const vnToday = getVnToday();
  const vnCurrentMonth = getVnCurrentMonth();

  // Month navigation
  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    const yr = prev.getFullYear();
    const mo = String(prev.getMonth() + 1).padStart(2, "0");
    onMonthChange(`${yr}-${mo}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const next = new Date(y, m, 1);
    const yr = next.getFullYear();
    const mo = String(next.getMonth() + 1).padStart(2, "0");
    onMonthChange(`${yr}-${mo}`);
  };

  const handleThisMonth = () => {
    onMonthChange(vnCurrentMonth);
  };

  // Day navigation
  const handlePrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    onDateChange(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    onDateChange(d.toISOString().slice(0, 10));
  };

  const handleToday = () => {
    onDateChange(vnToday);
  };

  // Format month display (e.g. "Tháng 09/2026")
  const [mYear, mMonth] = currentMonth.split("-");
  const monthDisplayStr = `Tháng ${mMonth}/${mYear}`;

  const formattedDate = new Date(`${currentDate}T12:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
      {/* Top Bar: View Mode Switcher + Month/Day Navigators */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: View Mode Tabs + Time Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab Switcher: Tháng | Ngày */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => onViewModeChange("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "month"
                  ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📅</span>
              <span>Tháng</span>
            </button>
            <button
              onClick={() => onViewModeChange("day")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "day"
                  ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🕒</span>
              <span>Ngày</span>
            </button>
          </div>

          {/* Controls for MONTH View */}
          {viewMode === "month" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl bg-slate-100 border border-slate-200 p-0.5 shadow-2xs">
                <button
                  onClick={handlePrevMonth}
                  title="Tháng trước"
                  className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="px-3 py-1.5 text-sm font-bold text-slate-900 font-mono tracking-wide flex items-center gap-1">
                  <span>{monthDisplayStr}</span>
                </div>

                <button
                  onClick={handleNextMonth}
                  title="Tháng sau"
                  className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Nút Tháng này */}
              {currentMonth !== vnCurrentMonth && (
                <Button size="sm" variant="secondary" onClick={handleThisMonth}>
                  Tháng này
                </Button>
              )}

              {/* Nút Hôm nay: Cuộn tới ngày hôm nay trên timeline */}
              <button
                onClick={onScrollToToday}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="Hệ thống tự động cuộn đến ngày hôm nay để xem booking nhanh"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>📍 Hôm nay ({vnToday.slice(8, 10)}/{vnToday.slice(5, 7)})</span>
              </button>
            </div>
          )}

          {/* Controls for DAY View */}
          {viewMode === "day" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl bg-slate-100 border border-slate-200 p-0.5 shadow-2xs">
                <button
                  onClick={handlePrevDay}
                  title="Ngày trước"
                  className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => e.target.value && onDateChange(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-900 px-2.5 py-1.5 focus:outline-none cursor-pointer"
                />

                <button
                  onClick={handleNextDay}
                  title="Ngày sau"
                  className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {currentDate !== vnToday && (
                <Button size="sm" variant="secondary" onClick={handleToday}>
                  Hôm nay
                </Button>
              )}

              <span className="hidden sm:inline-block text-xs font-semibold text-slate-700 capitalize pl-1">
                {formattedDate}
              </span>
            </div>
          )}
        </div>

        {/* Right: Room Filter Pills & Refresh */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs shadow-2xs">
            <button
              onClick={() => onFilterChange("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                roomFilter === "all"
                  ? "bg-white text-emerald-800 border border-slate-200 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả {roomCounts ? `(${roomCounts.all})` : ""}
            </button>
            <button
              onClick={() => onFilterChange("haven")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                roomFilter === "haven"
                  ? "bg-white text-sky-800 border border-slate-200 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Haven {roomCounts ? `(${roomCounts.haven})` : ""}
            </button>
            <button
              onClick={() => onFilterChange("signature")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                roomFilter === "signature"
                  ? "bg-white text-purple-800 border border-slate-200 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Signature {roomCounts ? `(${roomCounts.signature})` : ""}
            </button>
          </div>

          {/* Room Lock Button */}
          {onOpenRoomLockModal && (
            <button
              onClick={onOpenRoomLockModal}
              title="Khóa phòng tạm thời / Bảo trì"
              className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <span>🔒</span>
              <span className="hidden sm:inline">Khóa phòng</span>
            </button>
          )}

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Tải lại dữ liệu"
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-600" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
