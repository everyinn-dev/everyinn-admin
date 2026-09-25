"use client";

import React, { useMemo } from "react";
import { GanttBookingItem, GanttRoomData } from "@/types";
import { Badge } from "../ui/Badge";
import { GanttBar } from "./GanttBar";
import { TIMELINE_SLOTS, timeToDayOffset } from "@/lib/timelineUtils";

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

        {/* Room Blocks (Bảo trì / Khóa phòng) */}
        {room.blocks.map((block) => {
          const blockStart = new Date(block.blockedFrom).getTime();
          const blockEnd = new Date(block.blockedTo).getTime();
          if (blockEnd < timelineStartMs || blockStart > timelineEndMs) return null;

          const left = timeToTimelineX(blockStart);
          const right = timeToTimelineX(blockEnd);
          const width = Math.max(24, right - left);

          return (
            <div
              key={block.id}
              className="absolute top-1.5 bottom-1.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-[10px] text-amber-200 font-semibold flex items-center justify-center overflow-hidden z-10 shadow-sm"
              style={{ left: `${left}px`, width: `${width}px` }}
              title={`Khóa phòng: ${block.reason || "Bảo trì"}`}
            >
              <span className="truncate px-1.5">🔒 {block.reason || "Bảo trì"}</span>
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
