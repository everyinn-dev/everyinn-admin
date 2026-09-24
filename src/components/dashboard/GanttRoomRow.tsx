"use client";

import React from "react";
import { GanttBookingItem, GanttRoomData } from "@/types";
import { Badge } from "../ui/Badge";
import { GanttBar } from "./GanttBar";

interface GanttRoomRowProps {
  room: GanttRoomData;
  dayStartMs: number;
  dayEndMs: number;
  onBookingClick: (booking: GanttBookingItem) => void;
}

export const GanttRoomRow: React.FC<GanttRoomRowProps> = ({
  room,
  dayStartMs,
  dayEndMs,
  onBookingClick,
}) => {
  return (
    <div className="flex border-b border-slate-800/60 hover:bg-slate-900/30 transition-colors group">
      {/* Sticky Room Label Header */}
      <div className="w-48 sm:w-56 shrink-0 p-3 sm:px-4 flex items-center justify-between border-r border-slate-800/80 bg-[#0d131f] sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center font-bold text-sm text-slate-100 font-mono">
            {room.roomNumber}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 truncate max-w-[85px] sm:max-w-[100px]">
              {room.name}
            </div>
            <div className="text-[10px] text-slate-400">Tầng {room.floor}</div>
          </div>
        </div>

        <Badge roomClass={room.roomClass} size="sm" />
      </div>

      {/* 24-Hour Timeline Track */}
      <div className="flex-1 relative h-14 min-w-[960px] bg-slate-950/20">
        {/* 24 Hour slot vertical divider guidelines */}
        <div className="absolute inset-0 grid grid-cols-24 pointer-events-none">
          {Array.from({ length: 24 }).map((_, hour) => (
            <div
              key={hour}
              className={`border-r ${
                hour % 3 === 0
                  ? "border-slate-800/70 bg-slate-900/10"
                  : "border-slate-800/30"
              }`}
            />
          ))}
        </div>

        {/* Room Blocks (Maintenance/Holds) */}
        {room.blocks.map((block) => {
          const blockStart = new Date(block.blockedFrom).getTime();
          const blockEnd = new Date(block.blockedTo).getTime();
          const clampedStart = Math.max(dayStartMs, blockStart);
          const clampedEnd = Math.min(dayEndMs, blockEnd);
          const totalMs = dayEndMs - dayStartMs;
          const left = ((clampedStart - dayStartMs) / totalMs) * 100;
          const width = ((clampedEnd - clampedStart) / totalMs) * 100;

          return (
            <div
              key={block.id}
              className="absolute top-1 bottom-1 rounded-lg bg-stripes-amber border border-amber-500/30 text-[10px] text-amber-300 font-semibold flex items-center justify-center overflow-hidden z-5"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`Khóa phòng: ${block.reason || "Bảo trì"}`}
            >
              <span className="truncate px-1.5">🔒 {block.reason || "Bảo trì"}</span>
            </div>
          );
        })}

        {/* Booking Bars */}
        {room.bookings.map((booking) => (
          <GanttBar
            key={booking.id}
            booking={booking}
            dayStartMs={dayStartMs}
            dayEndMs={dayEndMs}
            onClick={onBookingClick}
          />
        ))}
      </div>
    </div>
  );
};
