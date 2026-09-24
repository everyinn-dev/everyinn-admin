"use client";

import React from "react";
import { Button } from "../ui/Button";

interface DateNavBarProps {
  currentDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  roomFilter: "all" | "haven" | "signature";
  onFilterChange: (filter: "all" | "haven" | "signature") => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const DateNavBar: React.FC<DateNavBarProps> = ({
  currentDate,
  onDateChange,
  roomFilter,
  onFilterChange,
  onRefresh,
  isLoading = false,
}) => {
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
    // Current date in Vietnam (UTC+7)
    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    onDateChange(today);
  };

  const formattedDate = new Date(currentDate).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-[#111724]/90 border border-slate-800/80 shadow-md">
      {/* Date Navigation */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5 shadow-inner">
          <button
            onClick={handlePrevDay}
            title="Ngày trước"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="bg-transparent text-sm font-semibold text-slate-100 px-3 py-1.5 focus:outline-none cursor-pointer"
          />

          <button
            onClick={handleNextDay}
            title="Ngày sau"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <Button size="sm" variant="secondary" onClick={handleToday}>
          Hôm nay
        </Button>

        <span className="hidden sm:inline-block text-xs font-medium text-slate-400 capitalize pl-1">
          {formattedDate}
        </span>
      </div>

      {/* Filter and Refresh */}
      <div className="flex items-center justify-between sm:justify-end gap-3">
        {/* Room Filter Pills */}
        <div className="flex items-center bg-slate-900/90 rounded-xl p-1 border border-slate-800 text-xs">
          <button
            onClick={() => onFilterChange("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              roomFilter === "all"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Tất cả (15)
          </button>
          <button
            onClick={() => onFilterChange("haven")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              roomFilter === "haven"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Haven (10)
          </button>
          <button
            onClick={() => onFilterChange("signature")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              roomFilter === "signature"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Signature (5)
          </button>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Tải lại dữ liệu"
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`}
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
  );
};
