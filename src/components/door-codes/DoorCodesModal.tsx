"use client";

import React, { useEffect, useState } from "react";
import { DoorCodesPanel } from "./DoorCodesPanel";
import type { GanttRoomData } from "@/types";

interface DoorCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isManager: boolean;
  initialDate?: string;
  preloadedDate?: string;
  preloadedRooms?: GanttRoomData[];
  onChanged?: () => void;
}

export const DoorCodesModal: React.FC<DoorCodesModalProps> = ({
  isOpen,
  onClose,
  isManager,
  initialDate,
  preloadedDate,
  preloadedRooms,
  onChanged,
}) => {
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="door-codes-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !hasUnsavedEdits) {
          onClose();
        }
      }}
    >
      <div className="relative w-full sm:max-w-5xl h-[94dvh] sm:h-auto sm:max-h-[90vh] bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Sticky Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.9"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 id="door-codes-modal-title" className="text-base font-extrabold text-slate-900 tracking-tight truncate">
                Quản lý & Tra cứu Mã cửa
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {isManager
                  ? "Cài đặt mã cổng theo ngày, khoảng ngày hoặc từng booking • Đồng bộ trực tiếp với AI Lễ Tân"
                  : "Xem mã cổng theo ngày hoặc booking và sao chép nhanh để gửi khách"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ mã cửa"
            className="w-9 h-9 rounded-xl bg-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-300 flex items-center justify-center transition-colors text-sm font-bold cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <DoorCodesPanel
            isManager={isManager}
            initialDate={initialDate}
            preloadedDate={preloadedDate}
            preloadedRooms={preloadedRooms}
            onChanged={onChanged}
            onDirtyChange={setHasUnsavedEdits}
          />
        </div>
      </div>
    </div>
  );
};
