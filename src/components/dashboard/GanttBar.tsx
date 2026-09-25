"use client";

import React, { useState } from "react";
import { GanttBookingItem } from "@/types";
import { formatDateTimeShort, formatTimeShort } from "@/lib/timelineUtils";

interface GanttBarProps {
  booking: GanttBookingItem;
  leftPx: number;
  widthPx: number;
  isMonthView?: boolean;
  onClick: (booking: GanttBookingItem) => void;
}

export const GanttBar: React.FC<GanttBarProps> = ({
  booking,
  leftPx,
  widthPx,
  isMonthView = false,
  onClick,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine colors based on booking type
  const typeStyles = {
    hourly: {
      bg: "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 border-emerald-400/60 shadow-emerald-950/40",
      dot: "bg-emerald-300",
      label: "Theo Giờ",
    },
    overnight: {
      bg: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-indigo-400/60 shadow-indigo-950/40",
      dot: "bg-indigo-300",
      label: "Qua Đêm",
    },
    dayuse: {
      bg: "bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 border-amber-400/60 shadow-amber-950/40",
      dot: "bg-amber-300",
      label: "Theo Ngày",
    },
    custom: {
      bg: "bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 border-fuchsia-400/60 shadow-fuchsia-950/40",
      dot: "bg-fuchsia-300",
      label: "Tuỳ Chỉnh",
    },
  };

  const styleConfig = typeStyles[booking.bookingType] || typeStyles.hourly;

  const timeLabel = isMonthView
    ? `${formatDateTimeShort(booking.checkinAt)} → ${formatDateTimeShort(booking.checkoutAt)}`
    : `${formatTimeShort(booking.checkinAt)} → ${formatTimeShort(booking.checkoutAt)}`;

  const compactTimeLabel = `${formatTimeShort(booking.checkinAt)} → ${formatTimeShort(booking.checkoutAt)}`;

  return (
    <div
      className="absolute top-1.5 bottom-1.5 z-10"
      style={{
        left: `${leftPx}px`,
        width: `${Math.max(28, widthPx)}px`,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => onClick(booking)}
    >
      <div
        className={`w-full h-full rounded-lg border text-white font-medium shadow-md cursor-pointer transition-all duration-150 flex items-center px-2 overflow-hidden select-none hover:scale-[1.01] hover:z-25 ${styleConfig.bg} ${
          booking.status === "pending" ? "border-dashed opacity-85 animate-pulse" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 truncate text-xs w-full">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styleConfig.dot}`} />
          <span className="font-bold truncate text-[11px] leading-tight">{booking.guestName}</span>
          {widthPx >= 140 && (
            <span className="text-[10px] text-white/90 font-mono shrink-0 pl-1">
              ({widthPx >= 220 ? timeLabel : compactTimeLabel})
            </span>
          )}
        </div>
      </div>

      {/* Floating Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-[#0c121d]/98 border border-slate-700 shadow-2xl backdrop-blur-md text-xs text-slate-200 pointer-events-none z-40 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between font-semibold border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="text-white font-bold truncate">{booking.guestName}</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
              {styleConfig.label}
            </span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Điện thoại:</span>
              <span className="font-mono text-slate-200 font-semibold">{booking.phone}</span>
            </div>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <span className="text-slate-400 text-[10px]">Thời gian đặt:</span>
              <div className="font-mono text-slate-100 font-bold text-[11px] bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                {formatDateTimeShort(booking.checkinAt)} → {formatDateTimeShort(booking.checkoutAt)}
              </div>
            </div>
            {booking.note && (
              <div className="flex flex-col gap-0.5 text-[10px] text-slate-400 pt-0.5 border-t border-slate-800">
                <span className="text-slate-500">Ghi chú:</span>
                <span className="italic text-slate-300">{booking.note}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-slate-800 font-semibold">
              <span className="text-slate-400">Tổng tiền:</span>
              <span className="text-emerald-400 font-mono font-bold">
                {Number(booking.totalPrice).toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
