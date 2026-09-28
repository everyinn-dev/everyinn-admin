"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { GanttBlockItem, GanttBookingItem, GanttRoomData } from "@/types";
import { GanttRoomRow, DayInfo } from "./GanttRoomRow";
import {
  TIMELINE_SLOTS,
  MONTH_SLOT_WIDTH_NORMAL,
  MONTH_SLOT_WIDTH_NIGHT,
  MONTH_DAY_WIDTH,
  DAY_SLOT_WIDTH_NORMAL,
  DAY_SLOT_WIDTH_NIGHT,
  SINGLE_DAY_TOTAL_WIDTH,
  getVnToday,
  formatDayHeaderShort,
  timeToDayOffset,
} from "@/lib/timelineUtils";

interface GanttChartProps {
  viewMode: "month" | "day";
  currentMonth: string; // YYYY-MM
  currentDate: string; // YYYY-MM-DD
  rooms: GanttRoomData[];
  onBookingClick: (booking: GanttBookingItem) => void;
  onBlockClick?: (block: GanttBlockItem, room: GanttRoomData) => void;
  scrollTrigger?: number; // increments when user clicks "Hôm nay"
}

export const GanttChart: React.FC<GanttChartProps> = ({
  viewMode,
  currentMonth,
  currentDate,
  rooms,
  onBookingClick,
  onBlockClick,
  scrollTrigger = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nowPx, setNowPx] = useState<number | null>(null);
  const [highlightToday, setHighlightToday] = useState(false);
  const hasInitialScrolled = useRef(false);

  const vnToday = useMemo(() => getVnToday(), []);

  // Determine sizing according to viewMode
  const isMonth = viewMode === "month";
  const slotWidthNormal = isMonth ? MONTH_SLOT_WIDTH_NORMAL : DAY_SLOT_WIDTH_NORMAL;
  const slotWidthNight = isMonth ? MONTH_SLOT_WIDTH_NIGHT : DAY_SLOT_WIDTH_NIGHT;
  const dayWidth = isMonth ? MONTH_DAY_WIDTH : SINGLE_DAY_TOTAL_WIDTH;

  // Generate days array
  const days: DayInfo[] = useMemo(() => {
    if (!isMonth) {
      const dayStart = new Date(`${currentDate}T00:00:00`).getTime();
      const dayEnd = dayStart + 24 * 3600 * 1000 - 1;
      const { weekday, dateFormatted } = formatDayHeaderShort(currentDate);
      return [
        {
          dateStr: currentDate,
          dayStartMs: dayStart,
          dayEndMs: dayEnd,
          isToday: currentDate === vnToday,
          weekday,
          dateFormatted,
        },
      ];
    }

    const [y, m] = currentMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const result: DayInfo[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentMonth}-${String(d).padStart(2, "0")}`;
      const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
      const dayEnd = dayStart + 24 * 3600 * 1000 - 1;
      const { weekday, dateFormatted } = formatDayHeaderShort(dateStr);
      result.push({
        dateStr,
        dayStartMs: dayStart,
        dayEndMs: dayEnd,
        isToday: dateStr === vnToday,
        weekday,
        dateFormatted,
      });
    }

    return result;
  }, [isMonth, currentMonth, currentDate, vnToday]);

  const totalTimelineWidth = days.length * dayWidth;
  const timelineStartMs = days[0]?.dayStartMs || 0;
  const timelineEndMs = days[days.length - 1]?.dayEndMs || 0;

  // Calculate live NOW line position
  useEffect(() => {
    const updateNow = () => {
      const nowMs = Date.now();
      if (nowMs < timelineStartMs || nowMs > timelineEndMs) {
        setNowPx(null);
        return;
      }

      let dayIdx = 0;
      for (let i = 0; i < days.length; i++) {
        if (nowMs >= days[i].dayStartMs && nowMs <= days[i].dayEndMs) {
          dayIdx = i;
          break;
        }
      }

      const day = days[dayIdx];
      if (!day) {
        setNowPx(null);
        return;
      }

      const dayOffset = timeToDayOffset(nowMs, day.dayStartMs, slotWidthNormal, slotWidthNight);
      setNowPx(dayIdx * dayWidth + dayOffset);
    };

    updateNow();
    const interval = setInterval(updateNow, 30000);
    return () => clearInterval(interval);
  }, [days, timelineStartMs, timelineEndMs, slotWidthNormal, slotWidthNight, dayWidth]);

  // Smooth scroll to today
  const scrollToToday = () => {
    if (!containerRef.current) return;
    const todayElement = document.getElementById(`gantt-day-${vnToday}`);
    if (todayElement && containerRef.current) {
      const containerLeft = containerRef.current.getBoundingClientRect().left;
      const elemLeft = todayElement.getBoundingClientRect().left;
      const offset = elemLeft - containerLeft + containerRef.current.scrollLeft - 240; // account for sticky column

      containerRef.current.scrollTo({
        left: Math.max(0, offset),
        behavior: "smooth",
      });

      // Highlight flash animation
      setHighlightToday(true);
      setTimeout(() => setHighlightToday(false), 2000);
    }
  };

  // Scroll to today on user trigger
  useEffect(() => {
    if (scrollTrigger > 0) {
      scrollToToday();
    }
  }, [scrollTrigger]);

  // Initial scroll to today in month view
  useEffect(() => {
    if (isMonth && !hasInitialScrolled.current && days.length > 0) {
      const timer = setTimeout(() => {
        scrollToToday();
        hasInitialScrolled.current = true;
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isMonth, days]);

  return (
    <div className="w-full rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Scrollable Timeline Container */}
      <div ref={containerRef} className="overflow-x-auto relative scroll-smooth select-none">
        <div style={{ width: `${totalTimelineWidth + 224}px`, minWidth: "100%" }}>
          {/* ================= HEADER: DAYS & HOURS ================= */}
          <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30 shadow-2xs">
            {/* Sticky Room Header Corner (Top Left) */}
            <div className="w-48 sm:w-56 shrink-0 p-3 sm:px-4 text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200 bg-slate-50 sticky left-0 z-40 flex items-center justify-between shadow-[2px_0_6px_rgba(0,0,0,0.03)]">
              <span className="flex items-center gap-1.5 font-extrabold text-slate-900">
                <span>🚪</span>
                <span>Phòng</span>
              </span>
              <span className="text-[10px] text-slate-700 font-bold px-2 py-0.5 rounded-full bg-slate-200">
                {rooms.length} phòng
              </span>
            </div>

            {/* Days and Hours Timeline Header */}
            <div className="flex" style={{ width: `${totalTimelineWidth}px` }}>
              {days.map((day) => (
                <div
                  key={day.dateStr}
                  id={`gantt-day-${day.dateStr}`}
                  className={`flex flex-col shrink-0 ${
                    day.isToday
                      ? `bg-emerald-50/70 border-r-2 border-emerald-500 ${
                          highlightToday ? "ring-2 ring-emerald-500 ring-inset" : ""
                        }`
                      : "border-r-2 border-slate-300"
                  }`}
                  style={{ width: `${dayWidth}px` }}
                >
                  {/* Row 1: Day Header Badge */}
                  <div
                    className={`h-9 px-3 flex items-center justify-between border-b ${
                      day.isToday
                        ? "bg-emerald-100/70 border-emerald-300 text-emerald-900"
                        : "bg-slate-100/80 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase font-mono tracking-tight text-slate-900">
                        {day.weekday}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {day.dateFormatted}
                      </span>
                    </div>

                    {day.isToday && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                        Hôm nay 📍
                      </span>
                    )}
                  </div>

                  {/* Row 2: Hour Grid Markers (19 slots) */}
                  <div className="flex h-7 items-center bg-slate-50 select-none">
                    {TIMELINE_SLOTS.map((slot) => {
                      const width = slot.isNight ? slotWidthNight : slotWidthNormal;
                      const isKeyHour = [9, 12, 15, 21].includes(slot.hour);

                      return (
                        <div
                          key={slot.id}
                          className={`h-full shrink-0 flex items-center justify-center border-r font-mono text-[10px] ${
                            slot.isNight
                              ? "bg-indigo-50/90 text-indigo-900 font-extrabold border-slate-200 px-1"
                              : `border-slate-200/80 ${
                                  isKeyHour
                                    ? slot.hour === 21
                                      ? "text-indigo-700 font-extrabold"
                                      : slot.hour === 15
                                      ? "text-amber-700 font-extrabold"
                                      : slot.hour === 12
                                      ? "text-sky-700 font-extrabold"
                                      : "text-emerald-700 font-extrabold"
                                    : "text-slate-600 font-medium"
                                }`
                          }`}
                          style={{ width: `${width}px` }}
                          title={slot.isNight ? "01:00 - 07:00 (Khung giờ đêm)" : `${slot.label}`}
                        >
                          {slot.isNight ? (
                            <span className="flex items-center gap-1">
                              <span>🌙</span>
                              <span>01h - 07h</span>
                            </span>
                          ) : (
                            <span>{slot.label}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================= BODY: ROOM TRACKS ================= */}
          <div className="relative">
            {/* Live 'Now' Red Vertical Line */}
            {nowPx !== null && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none transition-all duration-1000"
                style={{
                  left: `calc(14rem + ${nowPx}px)`, // 14rem = 224px (left corner room column)
                }}
              >
                <div className="h-full w-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                <div className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold tracking-wider uppercase shadow-2xs whitespace-nowrap">
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
                  days={days}
                  slotWidthNormal={slotWidthNormal}
                  slotWidthNight={slotWidthNight}
                  dayWidth={dayWidth}
                  totalTimelineWidth={totalTimelineWidth}
                  timelineStartMs={timelineStartMs}
                  timelineEndMs={timelineEndMs}
                  isMonthView={isMonth}
                  onBookingClick={onBookingClick}
                  onBlockClick={onBlockClick}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ================= LEGEND & FOOTER ================= */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 px-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold text-slate-800">Chú thích:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3 rounded bg-gradient-to-r from-emerald-600 to-teal-600 border border-emerald-700/30" />
            <span className="text-slate-800 font-medium">Theo Giờ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3 rounded bg-gradient-to-r from-indigo-600 to-violet-600 border border-indigo-700/30" />
            <span className="text-slate-800 font-medium">Qua Đêm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3 rounded bg-gradient-to-r from-amber-600 to-orange-500 border border-amber-700/30" />
            <span className="text-slate-800 font-medium">Theo Ngày</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3 rounded bg-gradient-to-r from-fuchsia-600 to-pink-600 border border-fuchsia-700/30" />
            <span className="text-slate-800 font-medium">Tuỳ Chỉnh</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-3.5 rounded bg-[repeating-linear-gradient(45deg,rgba(245,158,11,0.25),rgba(245,158,11,0.25)_3px,rgba(251,191,36,0.45)_3px,rgba(251,191,36,0.45)_6px)] bg-amber-100 border-2 border-amber-500 text-[9px] flex items-center justify-center font-bold text-amber-950 shadow-2xs">
              🔒
            </span>
            <span className="text-amber-900 font-bold">Khóa phòng (Bảo trì)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3 rounded border border-dashed border-amber-400 bg-amber-50" />
            <span className="text-amber-900 font-medium">🧹 Dọn phòng (1h)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[10px] text-indigo-900 font-bold font-mono">
              🌙 01h - 07h
            </span>
            <span className="text-slate-800 font-medium">Khung giờ đêm</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
          <span>💡 Nhấn vào thanh đặt phòng hoặc khóa phòng để xem chi tiết / chỉnh sửa</span>
        </div>
      </div>
    </div>
  );
};
