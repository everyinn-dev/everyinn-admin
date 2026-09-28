"use client";

import React from "react";

interface BookingsPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
}

export const BookingsPagination: React.FC<BookingsPaginationProps> = ({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}) => {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Generate page numbers to display (e.g. [1, 2, 3, 4, 5])
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxButtons = 5;

    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-xs text-slate-500">
      {/* Summary label */}
      <div className="font-medium text-slate-500 text-center sm:text-left">
        Hiển thị <span className="font-semibold text-slate-800">{from}</span>–
        <span className="font-semibold text-slate-800">{to}</span> trên tổng số{" "}
        <span className="font-semibold text-emerald-700 font-mono">{total}</span> đơn đặt phòng
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-1.5">
        {/* First page button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Trang đầu tiên"
        >
          «
        </button>

        {/* Previous page button */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Trang trước"
        >
          ‹
        </button>

        {/* Page pills */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isCurrent = pageNum === page;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next page button */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Trang sau"
        >
          ›
        </button>

        {/* Last page button */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Trang cuối cùng"
        >
          »
        </button>
      </div>
    </div>
  );
};
