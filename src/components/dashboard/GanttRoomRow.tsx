"use client";

import React, { useMemo } from "react";
import { GanttBlockItem, GanttBookingItem, GanttRoomData } from "@/types";
import { Badge } from "../ui/Badge";
import { GanttBar } from "./GanttBar";
import {
  TIMELINE_SLOTS,
  timeToDayOffset,
  formatTimeShort,
  formatDateTimeShort,
} from "@/lib/timelineUtils";

export interface DayInfo {
  dateStr: string; // YYYY-MM-DD
  dayStartMs: number;
  dayEndMs: number;
  isToday: boolean;
  weekday: string;
  dateFormatted: string;
}

interface GanttRoomRowProps {
  room: GanttRoomData;
  days: DayInfo[];
  slotWidthNormal: number;
  slotWidthNight: number;
  dayWidth: number;
  totalTimelineWidth: number;
  timelineStartMs: number;
  timelineEndMs: number;
  isMonthView: boolean;
  onBookingClick: (booking: GanttBookingItem) => void;
  onBlockClick?: (block: GanttBlockItem, room: GanttRoomData) => void;
}

export const GanttRoomRow: React.FC<GanttRoomRowProps> = ({
  room,
  days,
  slotWidthNormal,
  slotWidthNight,
  dayWidth,
  totalTimelineWidth,
  timelineStartMs,
  timelineEndMs,
  isMonthView,
  onBookingClick,
  onBlockClick,
}) => {
  // Convert any timeMs to X pixel coordinate on the timeline
  const timeToTimelineX = (timeMs: number): number => {
    const clamped = Math.max(timelineStartMs, Math.min(timelineEndMs, timeMs));
    let dayIdx = 0;
    for (let i = 0; i < days.length; i++) {
      if (clamped >= days[i].dayStartMs && clamped <= days[i].dayEndMs) {
        dayIdx = i;
        break;
      }
      if (clamped < days[i].dayStartMs) {
        dayIdx = i;
        break;
      }
      if (i === days.length - 1) {
        dayIdx = i;
      }
    }
    const day = days[dayIdx];
    const dayOffset = timeToDayOffset(clamped, day.dayStartMs, slotWidthNormal, slotWidthNight);
    return dayIdx * dayWidth + dayOffset;
  };

  return (
    <div className="flex border-b border-slate-800/80 hover:bg-slate-900/30 transition-colors group">
      {/* Sticky Room Label Header (Left Column) */}
      <div className="w-48 sm:w-56 shrink-0 p-3 sm:px-4 flex items-center justify-between border-r border-slate-800 bg-[#0d131f] sticky left-0 z-20 shadow-[3px_0_8px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center font-extrabold text-sm text-slate-100 font-mono shadow-inner">
            {room.roomNumber}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 truncate max-w-[85px] sm:max-w-[100px]">
              {room.name}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Tầng {room.floor}</div>
          </div>
        </div>

        <Badge roomClass={room.roomClass} size="sm" />
      </div>

      {/* Timeline Track */}
      <div
        className="relative h-14 bg-slate-950/30 select-none overflow-hidden"
        style={{ width: `${totalTimelineWidth}px`, minWidth: `${totalTimelineWidth}px` }}
      >
        {/* Background Grid: Days & Slots */}
        <div className="absolute inset-0 flex pointer-events-none">
          {days.map((day) => (
            <div
              key={day.dateStr}
              className={`flex shrink-0 h-full relative ${
                day.isToday
                  ? "bg-emerald-950/10 border-r-2 border-emerald-500/70"
                  : "border-r-2 border-slate-600/90"
              }`}
              style={{ width: `${dayWidth}px` }}
            >
              {TIMELINE_SLOTS.map((slot) => {
                const width = slot.isNight ? slotWidthNight : slotWidthNormal;
                return (
                  <div
                    key={slot.id}
                    className={`h-full shrink-0 border-r ${
                      slot.isNight
                        ? "bg-indigo-950/25 border-slate-700/80"
                        : "border-slate-800/70 hover:bg-slate-800/10"
                    }`}
                    style={{ width: `${width}px` }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Room Blocks (Bảo trì / Khóa phòng - Thanh kéo dài nổi bật theo giờ khóa) */}
        {room.blocks.map((block) => {
          const blockStart = new Date(block.blockedFrom).getTime();
          const blockEnd = new Date(block.blockedTo).getTime();
          if (blockEnd < timelineStartMs || blockStart > timelineEndMs) return null;

          const startsBefore = blockStart < timelineStartMs;
          const endsAfter = blockEnd > timelineEndMs;

          const left = timeToTimelineX(blockStart);
          const right = timeToTimelineX(blockEnd);
          const width = Math.max(28, right - left);

          const timeLabel = `${formatTimeShort(block.blockedFrom)} - ${formatTimeShort(block.blockedTo)}`;
          const fullLabel = `Khóa: ${block.reason || "Bảo trì"}`;

          return (
            <div
              key={block.id}
              onClick={() => onBlockClick?.(block, room)}
              className="absolute top-1.5 bottom-1.5 rounded-lg bg-[repeating-linear-gradient(45deg,rgba(180,83,9,0.4),rgba(180,83,9,0.4)_10px,rgba(245,158,11,0.22)_10px,rgba(245,158,11,0.22)_20px)] bg-amber-950/90 border-2 border-amber-400/90 text-amber-100 font-bold flex items-center justify-between overflow-hidden z-15 shadow-md shadow-amber-950/50 cursor-pointer hover:border-amber-300 hover:scale-[1.01] hover:brightness-110 transition-all select-none group/block"
              style={{ left: `${left}px`, width: `${width}px` }}
              title={`🔒 Khóa phòng: ${block.reason || "Bảo trì"}\nThời gian: ${formatDateTimeShort(block.blockedFrom)} → ${formatDateTimeShort(block.blockedTo)}${block.note ? `\nGhi chú: ${block.note}` : ""}\n(Bấm để xem chi tiết / mở khóa)`}
            >
              {/* Left indicator if continued from yesterday */}
              {startsBefore && (
                <span className="shrink-0 pl-1 text-[10px] text-amber-300 animate-pulse font-mono font-extrabold">
                  ◀
                </span>
              )}

              <div className="flex items-center gap-1 px-1.5 truncate text-[11px] leading-tight">
                <span className="text-xs">🔒</span>
                {width >= 140 ? (
                  <span className="truncate">
                    {fullLabel}{" "}
                    <span className="text-[10px] font-mono text-amber-300/90 font-medium">
                      ({timeLabel})
                    </span>
                  </span>
                ) : width >= 75 ? (
                  <span className="truncate">{fullLabel}</span>
                ) : width >= 40 ? (
                  <span className="truncate text-[10px]">Khóa</span>
                ) : null}
              </div>

              {/* Right indicator if continues to tomorrow */}
              {endsAfter && (
                <span className="shrink-0 pr-1 text-[10px] text-amber-300 animate-pulse font-mono font-extrabold">
                  ▶
                </span>
              )}
            </div>
          );
        })}

        {/* Turnover / Cleaning Buffer Bars (1h after checkout) */}
        {room.bookings.map((booking) => {
          if (booking.status === "cancelled") return null;
          const checkoutMs = new Date(booking.checkoutAt).getTime();
          const cleanUntilMs = checkoutMs + 60 * 60 * 1000;
          if (cleanUntilMs < timelineStartMs || checkoutMs > timelineEndMs) return null;

          // Check if a Room Lock starts right at checkout or within the 1h buffer
          // If a block starts at or within 5 min of checkoutMs, suppress the cleaning buffer completely!
          const overlappingBlock = room.blocks.find((block) => {
            const blockStartMs = new Date(block.blockedFrom).getTime();
            const blockEndMs = new Date(block.blockedTo).getTime();
            return (
              (blockStartMs <= checkoutMs + 5 * 60 * 1000 && blockEndMs > checkoutMs) ||
              (blockStartMs >= checkoutMs && blockStartMs < cleanUntilMs)
            );
          });

          let effectiveCleanUntilMs = cleanUntilMs;
          if (overlappingBlock) {
            const blockStartMs = new Date(overlappingBlock.blockedFrom).getTime();
            if (blockStartMs <= checkoutMs + 5 * 60 * 1000) {
              // Block immediately follows or covers checkout: suppress 1h cleaning buffer
              return null;
            }
            effectiveCleanUntilMs = Math.min(cleanUntilMs, blockStartMs);
          }

          const left = timeToTimelineX(checkoutMs);
          const right = timeToTimelineX(Math.min(effectiveCleanUntilMs, timelineEndMs));
          const width = Math.max(6, right - left);
          if (width <= 0) return null;

          return (
            <div
              key={`clean-${booking.id}`}
              className="absolute top-1.5 bottom-1.5 rounded-r-md border border-dashed border-amber-500/70 bg-amber-500/15 text-[10px] text-amber-300 font-medium flex items-center justify-center overflow-hidden z-5 pointer-events-none select-none transition-opacity"
              style={{ left: `${left}px`, width: `${width}px` }}
              title={`Dọn phòng: ${new Date(checkoutMs).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })} - ${new Date(effectiveCleanUntilMs).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
            >
              {width >= 34 ? (
                <span className="truncate px-1 text-[9px] flex items-center gap-1 font-bold text-amber-200">
                  🧹 Dọn
                </span>
              ) : width >= 14 ? (
                <span className="text-[10px]">🧹</span>
              ) : null}
            </div>
          );
        })}

        {/* Booking Bars */}
        {room.bookings.map((booking) => {
          const checkinMs = new Date(booking.checkinAt).getTime();
          const checkoutMs = new Date(booking.checkoutAt).getTime();
          if (checkoutMs < timelineStartMs || checkinMs > timelineEndMs) return null;

          const left = timeToTimelineX(checkinMs);
          const right = timeToTimelineX(checkoutMs);
          const width = Math.max(28, right - left);

          return (
            <GanttBar
              key={booking.id}
              booking={booking}
              leftPx={left}
              widthPx={width}
              isMonthView={isMonthView}
              onClick={onBookingClick}
            />
          );
        })}
      </div>
    </div>
  );
};
