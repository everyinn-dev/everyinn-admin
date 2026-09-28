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
  status: string;
  onStatusChange: (value: string) => void;
  depositStatus?: string;
  onDepositStatusChange?: (value: string) => void;
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
  status,
  onStatusChange,
  depositStatus = "",
  onDepositStatusChange,
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
    (search && search.length >= 3) || status || depositStatus || roomId || bookingType || createdBy || createdFrom || createdTo
  );

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5">
      {/* Search Input Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm theo SĐT, tên khách, Instagram, Facebook, mã đặt (tối thiểu 3 ký tự)..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-4 py-2.5 pl-10 pr-28 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-colors shadow-xs font-medium"
          />
          <span className="absolute left-3.5 top-3 text-slate-400 text-sm">
            🔍
          </span>

          {/* Typing helper indicator when 1 or 2 characters are entered */}
          {localSearch.trim().length > 0 && localSearch.trim().length < 3 && (
            <span className="absolute right-10 top-2.5 text-[10px] text-amber-800 font-bold px-2 py-0.5 rounded bg-amber-50 border border-amber-200 animate-in fade-in select-none">
              Nhập thêm {3 - localSearch.trim().length} ký tự
            </span>
          )}

          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch("");
                onSearchChange("");
              }}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-800 text-xs px-1.5 py-0.5 rounded bg-slate-100 font-bold cursor-pointer"
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-rose-700 hover:text-rose-800 border border-slate-300 text-xs font-bold transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs"
            title="Xóa tất cả bộ lọc hiện tại"
          >
            <span>🔄</span>
            <span>Đặt lại bộ lọc</span>
          </button>
        )}
      </div>

      {/* Filter Dropdowns & Date Range */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 text-xs">
        {/* Dropdown: Trạng thái */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600">Trạng thái</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-colors shadow-xs"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="no_show">🚫 No-Show</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>

        {/* Dropdown: Đặt cọc */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600">Đặt cọc</label>
          <select
            value={depositStatus}
            onChange={(e) => onDepositStatusChange?.(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 transition-colors shadow-xs"
          >
            <option value="">Tất cả cọc</option>
            <option value="deposit_paid">🪙 Đang nợ cọc (Chờ thu nốt)</option>
            <option value="fully_paid">✅ Đã thu đủ 100%</option>
            <option value="none">Không đặt cọc</option>
          </select>
        </div>

        {/* Dropdown: Phòng */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600">Phòng</label>
          <select
            value={roomId}
            onChange={(e) => onRoomChange(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-colors shadow-xs"
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
          <label className="text-[11px] font-bold text-slate-600">Loại hình</label>
          <select
            value={bookingType}
            onChange={(e) => onBookingTypeChange(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-colors shadow-xs"
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
          <label className="text-[11px] font-bold text-slate-600">Người tạo</label>
          <select
            value={createdBy}
            onChange={(e) => onCreatedByChange(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-colors shadow-xs"
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
          <label className="text-[11px] font-bold text-slate-600">Tạo từ ngày</label>
          <input
            type="date"
            value={createdFrom}
            onChange={(e) => onCreatedFromChange(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-colors shadow-xs"
          />
        </div>

        {/* Date: Ngày tạo - Đến ngày */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600">Tạo đến ngày</label>
          <input
            type="date"
            value={createdTo}
            onChange={(e) => onCreatedToChange(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-colors shadow-xs"
          />
        </div>
      </div>
    </div>
  );
};
