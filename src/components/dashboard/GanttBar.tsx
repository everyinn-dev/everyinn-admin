"use client";

import React, { useState } from "react";
import { GanttBookingItem } from "@/types";

interface GanttBarProps {
  booking: GanttBookingItem;
  dayStartMs: number;
  dayEndMs: number;
  onClick: (booking: GanttBookingItem) => void;
}

export const GanttBar: React.FC<GanttBarProps> = ({
  booking,
  dayStartMs,
  dayEndMs,
  onClick,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const checkinMs = new Date(booking.checkinAt).getTime();
  const checkoutMs = new Date(booking.checkoutAt).getTime();

  // Clamp within the 24h day window
  const clampedStart = Math.max(dayStartMs, checkinMs);
  const clampedEnd = Math.min(dayEndMs, checkoutMs);

  const totalDayMs = dayEndMs - dayStartMs;
  const leftPercent = Math.max(0, Math.min(100, ((clampedStart - dayStartMs) / totalDayMs) * 100));
  const rawWidthPercent = ((clampedEnd - clampedStart) / totalDayMs) * 100;
  const widthPercent = Math.max(2.5, Math.min(100 - leftPercent, rawWidthPercent));

  // Determine colors based on booking type
  const typeStyles = {
    hourly: {
      bg: "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 border-emerald-400/40 shadow-emerald-900/30",
      dot: "bg-emerald-300",
      label: "Theo Giờ",
    },
    overnight: {
      bg: "bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 border-indigo-400/40 shadow-indigo-900/30",
      dot: "bg-indigo-300",
      label: "Qua Đêm",
    },
    dayuse: {
      bg: "bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 border-amber-400/40 shadow-amber-900/30",
      dot: "bg-amber-300",
      label: "Theo Ngày",
    },
  };

  const styleConfig = typeStyles[booking.bookingType] || typeStyles.hourly;

  const formatHour = (iso: string) => {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="absolute top-1 bottom-1 z-10"
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => onClick(booking)}
    >
      <div
        className={`w-full h-full rounded-lg border text-white font-medium shadow-md cursor-pointer transition-all duration-150 flex items-center px-2.5 overflow-hidden select-none hover:scale-[1.01] hover:z-20 ${styleConfig.bg} ${
          booking.status === "pending" ? "border-dashed opacity-85 animate-pulse" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 truncate text-xs w-full">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styleConfig.dot}`} />
          <span className="font-semibold truncate">{booking.guestName}</span>
          <span className="text-[11px] opacity-80 hidden xl:inline shrink-0">
            ({formatHour(booking.checkinAt)} - {formatHour(booking.checkoutAt)})
          </span>
        </div>
      </div>

      {/* Floating Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs text-slate-200 pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between font-semibold border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="text-white truncate">{booking.guestName}</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {styleConfig.label}
            </span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Điện thoại:</span>
              <span className="font-mono text-slate-200">{booking.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Giờ đặt:</span>
              <span className="text-slate-200">
                {formatHour(booking.checkinAt)} → {formatHour(booking.checkoutAt)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 font-semibold">
              <span className="text-slate-400">Tổng tiền:</span>
              <span className="text-emerald-400 font-mono">
                {Number(booking.totalPrice).toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
