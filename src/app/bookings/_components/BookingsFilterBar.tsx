"use client";

import React, { useState, useEffect } from "react";
import { Room } from "@/types";

interface StaffOption {
  id: number;
  full_name: string;
  role: string;
}

interface BookingsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  roomId: string;
  onRoomChange: (value: string) => void;
  bookingType: string;
  onBookingTypeChange: (value: string) => void;
  createdBy: string;
  onCreatedByChange: (value: string) => void;
  createdFrom: string;
  onCreatedFromChange: (value: string) => void;
  createdTo: string;
  onCreatedToChange: (value: string) => void;
  onResetFilters: () => void;
  rooms: Room[];
  staffList: StaffOption[];
}

export const BookingsFilterBar: React.FC<BookingsFilterBarProps> = ({
  search,
  onSearchChange,
  roomId,
  onRoomChange,
  bookingType,
  onBookingTypeChange,
  createdBy,
  onCreatedByChange,
  createdFrom,
  onCreatedFromChange,
  createdTo,
  onCreatedToChange,
  onResetFilters,
  rooms,
  staffList,
}) => {
  // Local search state for debouncing
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const trimmed = localSearch.trim();
    const timer = setTimeout(() => {
      // Track at least 3 characters before triggering search query
      if (trimmed.length === 0) {
        if (search !== "") {
          onSearchChange("");
        }
      } else if (trimmed.length >= 3) {
        if (trimmed !== search) {
          onSearchChange(trimmed);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [localSearch, search, onSearchChange]);

  const hasActiveFilters = Boolean(
    (search && search.length >= 3) || roomId || bookingType || createdBy || createdFrom || createdTo
  );

  return (
    <div className="p-4 rounded-2xl bg-[#0d131f] border border-slate-800 shadow-md space-y-3.5">
      {/* Search Input Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm theo SĐT, tên khách, Instagram, Facebook, mã đặt (tối thiểu 3 ký tự)..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-4 py-2.5 pl-10 pr-28 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
          />
          <span className="absolute left-3.5 top-3 text-slate-400 text-sm">
            🔍
          </span>

          {/* Typing helper indicator when 1 or 2 characters are entered */}
          {localSearch.trim().length > 0 && localSearch.trim().length < 3 && (
            <span className="absolute right-10 top-2.5 text-[10px] text-amber-400/90 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 animate-in fade-in select-none">
              Nhập thêm {3 - localSearch.trim().length} ký tự
            </span>
          )}

          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch("");
                onSearchChange("");
              }}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded bg-slate-800"
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-rose-300 hover:text-rose-200 border border-slate-700 text-xs font-semibold transition-all active:scale-95 shrink-0"
            title="Xóa tất cả bộ lọc hiện tại"
          >
            <span>🔄</span>
            <span>Đặt lại bộ lọc</span>
          </button>
        )}
      </div>

      {/* Filter Dropdowns & Date Range */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
        {/* Dropdown: Phòng */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Phòng</label>
          <select
            value={roomId}
            onChange={(e) => onRoomChange(e.target.value)}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="">Tất cả phòng</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.room_class === "signature" ? "Signature" : "Haven"})
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown: Loại hình */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Loại hình</label>
          <select
            value={bookingType}
            onChange={(e) => onBookingTypeChange(e.target.value)}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="">Tất cả loại hình</option>
            <option value="hourly">Theo Giờ (Hourly)</option>
            <option value="overnight">Qua Đêm (Overnight)</option>
            <option value="dayuse">Theo Ngày (Day Use)</option>
            <option value="custom">Tuỳ Chỉnh (Custom)</option>
          </select>
        </div>

        {/* Dropdown: Người tạo */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Người tạo</label>
          <select
            value={createdBy}
            onChange={(e) => onCreatedByChange(e.target.value)}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="">Tất cả người tạo</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.role === "manager" ? "Quản lý" : "Lễ tân"})
              </option>
            ))}
          </select>
        </div>

        {/* Date: Ngày tạo - Từ ngày */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Tạo từ ngày</label>
          <input
            type="date"
            value={createdFrom}
            onChange={(e) => onCreatedFromChange(e.target.value)}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Date: Ngày tạo - Đến ngày */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Tạo đến ngày</label>
          <input
            type="date"
            value={createdTo}
            onChange={(e) => onCreatedToChange(e.target.value)}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};
