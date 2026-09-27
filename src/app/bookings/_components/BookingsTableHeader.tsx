"use client";

import React from "react";

interface BookingsTableHeaderProps {
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (column: string) => void;
}

export const BookingsTableHeader: React.FC<BookingsTableHeaderProps> = ({
  sortBy,
  sortDir,
  onSort,
}) => {
  const renderSortIcon = (columnKey: string) => {
    const isActive = sortBy === columnKey;
    if (!isActive) {
      return (
        <span className="text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity">
          ↕
        </span>
      );
    }
    return (
      <span className="text-emerald-400 font-bold">
        {sortDir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <thead className="bg-[#0b101a] border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider font-semibold select-none">
      <tr>
        {/* 1. Mã đặt */}
        <th className="py-3 px-3 text-left whitespace-nowrap">Mã đặt</th>

        {/* 2. Instagram */}
        <th className="py-3 px-3 text-left whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-pink-400/90">
            <span>📸</span>
            <span>Instagram</span>
          </span>
        </th>

        {/* 3. Facebook */}
        <th className="py-3 px-3 text-left whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-blue-400/90">
            <span className="font-bold">f</span>
            <span>Facebook</span>
          </span>
        </th>

        {/* 4. Khách hàng */}
        <th className="py-3 px-3 text-left whitespace-nowrap">Khách hàng</th>

        {/* 5. Phòng */}
        <th className="py-3 px-3 text-left whitespace-nowrap">Phòng</th>

        {/* 6. Loại hình */}
        <th className="py-3 px-3 text-left whitespace-nowrap">Loại hình</th>

        {/* 7. Thời gian check-in (Sortable) */}
        <th
          onClick={() => onSort("checkin_at")}
          className="py-3 px-3 text-left whitespace-nowrap cursor-pointer hover:bg-slate-800/50 hover:text-slate-200 transition-colors group"
          title="Bấm để sắp xếp theo thời gian check-in"
        >
          <div className="inline-flex items-center gap-1.5">
            <span>Check-in</span>
            {renderSortIcon("checkin_at")}
          </div>
        </th>

        {/* 8. Thời gian check-out (Sortable) */}
        <th
          onClick={() => onSort("checkout_at")}
          className="py-3 px-3 text-left whitespace-nowrap cursor-pointer hover:bg-slate-800/50 hover:text-slate-200 transition-colors group"
          title="Bấm để sắp xếp theo thời gian check-out"
        >
          <div className="inline-flex items-center gap-1.5">
            <span>Check-out</span>
            {renderSortIcon("checkout_at")}
          </div>
        </th>

        {/* 9. Tổng tiền */}
        <th className="py-3 px-3 text-right whitespace-nowrap">Tổng tiền</th>

        {/* 10. Người tạo */}
        <th className="py-3 px-3 text-left whitespace-nowrap">Người tạo</th>

        {/* 11. Ngày tạo */}
        <th className="py-3 px-3 text-left whitespace-nowrap">Ngày tạo</th>

        {/* 12. Lần sửa (Mod) */}
        <th
          onClick={() => onSort("mod_no")}
          className="py-3 px-3 text-left whitespace-nowrap cursor-pointer hover:bg-slate-800/50 hover:text-slate-200 transition-colors group"
          title="Bấm để sắp xếp theo số lần chỉnh sửa"
        >
          <div className="inline-flex items-center gap-1.5">
            <span>Lần sửa (Mod)</span>
            {renderSortIcon("mod_no")}
          </div>
        </th>
      </tr>
    </thead>
  );
};
