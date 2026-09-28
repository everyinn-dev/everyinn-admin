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
      bg: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 border-emerald-700/30 shadow-xs",
      dot: "bg-emerald-200",
      label: "Theo Giờ",
      badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-300",
    },
    overnight: {
      bg: "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 border-indigo-700/30 shadow-xs",
      dot: "bg-indigo-200",
      label: "Qua Đêm",
      badgeStyle: "bg-indigo-50 text-indigo-800 border-indigo-300",
    },
    dayuse: {
      bg: "bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 border-amber-700/30 shadow-xs",
      dot: "bg-amber-200",
      label: "Theo Ngày",
      badgeStyle: "bg-amber-50 text-amber-900 border-amber-300",
    },
    custom: {
      bg: "bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 border-fuchsia-700/30 shadow-xs",
      dot: "bg-fuchsia-200",
      label: "Tuỳ Chỉnh",
      badgeStyle: "bg-fuchsia-50 text-fuchsia-900 border-fuchsia-300",
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
        className={`w-full h-full rounded-lg border text-white font-medium cursor-pointer transition-all duration-150 flex items-center px-2 overflow-hidden select-none hover:scale-[1.01] hover:z-25 ${styleConfig.bg} ${
          booking.status === "pending" ? "border-dashed opacity-85 animate-pulse" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 truncate text-xs w-full">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styleConfig.dot}`} />
          <span className="font-bold truncate text-[11px] leading-tight text-white drop-shadow-xs">{booking.guestName}</span>
          {widthPx >= 140 && (
            <span className="text-[10px] text-white/95 font-mono shrink-0 pl-1">
              ({widthPx >= 220 ? timeLabel : compactTimeLabel})
            </span>
          )}
        </div>
      </div>

      {/* Floating Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3.5 rounded-2xl bg-white/98 border border-slate-200 shadow-xl backdrop-blur-md text-xs text-slate-700 pointer-events-none z-40 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between font-semibold border-b border-slate-100 pb-1.5 mb-1.5">
            <span className="text-slate-900 font-extrabold truncate">{booking.guestName}</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${styleConfig.badgeStyle}`}>
              {styleConfig.label}
            </span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Điện thoại:</span>
              <span className="font-mono text-slate-900 font-bold">{booking.phone}</span>
            </div>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <span className="text-slate-500 text-[10px]">Thời gian đặt:</span>
              <div className="font-mono text-slate-800 font-bold text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200">
                {formatDateTimeShort(booking.checkinAt)} → {formatDateTimeShort(booking.checkoutAt)}
              </div>
            </div>
            {booking.note && (
              <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 pt-0.5 border-t border-slate-100">
                <span className="text-slate-400">Ghi chú:</span>
                <span className="italic text-slate-700">{booking.note}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-slate-100 font-semibold">
              <span className="text-slate-500">Tổng tiền:</span>
              <span className="text-emerald-700 font-mono font-extrabold">
                {Number(booking.totalPrice).toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
