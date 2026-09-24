"use client";

import React, { useEffect, useState } from "react";
import { GanttBookingItem, GanttRoomData } from "@/types";
import { GanttRoomRow } from "./GanttRoomRow";

interface GanttChartProps {
  currentDate: string; // YYYY-MM-DD
  rooms: GanttRoomData[];
  onBookingClick: (booking: GanttBookingItem) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  currentDate,
  rooms,
  onBookingClick,
}) => {
  const [nowPercent, setNowPercent] = useState<number | null>(null);

  // Calculate day start and end in epoch ms for this date
  const dayStart = new Date(`${currentDate}T00:00:00`).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  // Track real-time indicator if target date is today
  useEffect(() => {
    const updateNow = () => {
      const now = new Date();
      // Vietnam local ISO date
      const vnToday = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

      if (currentDate === vnToday) {
        const nowMs = now.getTime();
        if (nowMs >= dayStart && nowMs <= dayEnd) {
          const percent = ((nowMs - dayStart) / (dayEnd - dayStart)) * 100;
          setNowPercent(percent);
          return;
        }
      }
      setNowPercent(null);
    };

    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, [currentDate, dayStart, dayEnd]);

  const hours = Array.from({ length: 24 }).map((_, i) => `${i}h`);

  return (
    <div className="w-full rounded-2xl bg-[#0d131f] border border-slate-800 shadow-xl overflow-hidden flex flex-col">
      {/* Scrollable Timeline Container */}
      <div className="overflow-x-auto relative">
        <div className="min-w-[1200px]">
          {/* Timeline Header Row */}
          <div className="flex border-b border-slate-800 bg-[#0b101a] sticky top-0 z-20">
            {/* Corner Room Header */}
            <div className="w-48 sm:w-56 shrink-0 p-3 sm:px-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-slate-800 bg-[#0b101a] sticky left-0 z-30 flex items-center justify-between">
              <span>Phòng</span>
              <span className="text-[10px] text-slate-500 font-normal">({rooms.length} phòng)</span>
            </div>

            {/* 24-Hour Markers */}
            <div className="flex-1 grid grid-cols-24 relative py-2.5">
              {hours.map((h, i) => (
                <div
                  key={i}
                  className="text-center text-[11px] font-semibold text-slate-400 font-mono select-none"
                >
                  <span className={i % 3 === 0 ? "text-emerald-400 font-bold" : ""}>{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Body Rows with relative container for Now Indicator */}
          <div className="relative">
            {/* Live 'Now' Red Vertical Line */}
            {nowPercent !== null && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none transition-all duration-1000"
                style={{
                  left: `calc(12rem + (100% - 12rem) * ${nowPercent / 100})`,
                }}
              >
                <div className="h-full w-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                <div className="absolute -top-6 -translate-x-1/2 px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-bold tracking-wider uppercase shadow-md shadow-rose-900/50">
                  BÂY GIỜ
                </div>
              </div>
            )}

            {rooms.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-sm">
                Không tìm thấy phòng nào phù hợp với bộ lọc.
              </div>
            ) : (
              rooms.map((room) => (
                <GanttRoomRow
                  key={room.id}
                  room={room}
                  dayStartMs={dayStart}
                  dayEndMs={dayEnd}
                  onBookingClick={onBookingClick}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend Footer */}
      <div className="p-3 bg-[#0a0f17] border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 px-4">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-300">Chú thích loại hình:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-r from-emerald-600 to-teal-500 border border-emerald-400/40" />
            <span>Theo Giờ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-r from-indigo-600 to-purple-500 border border-indigo-400/40" />
            <span>Qua Đêm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-r from-amber-600 to-orange-500 border border-amber-400/40" />
            <span>Theo Ngày</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>💡 Nhấn vào thanh đặt phòng để xem chi tiết hoặc hủy phòng</span>
        </div>
      </div>
    </div>
  );
};
