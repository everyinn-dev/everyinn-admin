"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { GanttBlockItem, GanttBookingItem, GanttRoomData } from "@/types";
import {
  TIMELINE_SLOTS,
  MOBILE_SLOT_HEIGHT_NORMAL,
  MOBILE_SLOT_HEIGHT_NIGHT,
  MOBILE_TOTAL_DAY_HEIGHT,
  getVnToday,
  formatDayHeaderShort,
  timeToDayOffset,
  formatTimeShort,
  formatDateTimeShort,
} from "@/lib/timelineUtils";

interface MobileVerticalGanttProps {
  viewMode: "month" | "day";
  currentMonth: string; // YYYY-MM
  currentDate: string; // YYYY-MM-DD
  rooms: GanttRoomData[];
  onBookingClick: (booking: GanttBookingItem) => void;
  onBlockClick?: (block: GanttBlockItem, room: GanttRoomData) => void;
  scrollTrigger?: number;
}

const TIME_COL_WIDTH = 54; // px (giảm ~20% từ 68px xuống 54px)
const ROOM_COL_WIDTH = 57; // px (giảm thêm 20% từ 71px xuống 57px: 71 * 0.8 = 56.8px)
const HEADER_HEIGHT = 44; // px (header gọn, chỉ hiển thị số phòng 101, 102...)
const DAY_HEADER_HEIGHT = 32; // px (header ngày giữa các ngày trong month view, cân đối với hàng giờ 26px)

const ROOM_HEADER_PALETTES = [
  "bg-blue-100 text-blue-900 border-blue-300",
  "bg-emerald-100 text-emerald-900 border-emerald-300",
  "bg-purple-100 text-purple-900 border-purple-300",
  "bg-amber-100 text-amber-900 border-amber-300",
  "bg-rose-100 text-rose-900 border-rose-300",
  "bg-cyan-100 text-cyan-900 border-cyan-300",
  "bg-indigo-100 text-indigo-900 border-indigo-300",
  "bg-teal-100 text-teal-900 border-teal-300",
];

// 7 màu sắc riêng biệt cho 7 ngày trong tuần (0: CN, 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7)
const DAY_OF_WEEK_THEMES = [
  // 0: Chủ nhật (Đỏ Ruby)
  {
    weekday: "CN",
    name: "Chủ nhật",
    markerBg: "bg-red-600 text-white",
    markerBorder: "border-red-700",
    dividerBg: "bg-red-100/90 text-red-950",
    dividerBorder: "border-red-300",
    dividerTopBorder: "border-t-2 border-t-red-600",
    badgeBg: "bg-red-600 text-white",
    daySlotTint: "bg-red-50/15",
  },
  // 1: Thứ 2 (Xanh lam)
  {
    weekday: "T2",
    name: "Thứ hai",
    markerBg: "bg-blue-600 text-white",
    markerBorder: "border-blue-700",
    dividerBg: "bg-blue-100/90 text-blue-950",
    dividerBorder: "border-blue-300",
    dividerTopBorder: "border-t-2 border-t-blue-600",
    badgeBg: "bg-blue-600 text-white",
    daySlotTint: "bg-blue-50/15",
  },
  // 2: Thứ 3 (Xanh ngọc / Teal)
  {
    weekday: "T3",
    name: "Thứ ba",
    markerBg: "bg-teal-600 text-white",
    markerBorder: "border-teal-700",
    dividerBg: "bg-teal-100/90 text-teal-950",
    dividerBorder: "border-teal-300",
    dividerTopBorder: "border-t-2 border-t-teal-600",
    badgeBg: "bg-teal-600 text-white",
    daySlotTint: "bg-teal-50/15",
  },
  // 3: Thứ 4 (Hổ phách / Vàng cam)
  {
    weekday: "T4",
    name: "Thứ tư",
    markerBg: "bg-amber-500 text-amber-950 font-black",
    markerBorder: "border-amber-600",
    dividerBg: "bg-amber-100/90 text-amber-950",
    dividerBorder: "border-amber-300",
    dividerTopBorder: "border-t-2 border-t-amber-500",
    badgeBg: "bg-amber-600 text-white",
    daySlotTint: "bg-amber-50/15",
  },
  // 4: Thứ 5 (Tím Violet)
  {
    weekday: "T5",
    name: "Thứ năm",
    markerBg: "bg-purple-600 text-white",
    markerBorder: "border-purple-700",
    dividerBg: "bg-purple-100/90 text-purple-950",
    dividerBorder: "border-purple-300",
    dividerTopBorder: "border-t-2 border-t-purple-600",
    badgeBg: "bg-purple-600 text-white",
    daySlotTint: "bg-purple-50/15",
  },
  // 5: Thứ 6 (Hồng dâu / Rose)
  {
    weekday: "T6",
    name: "Thứ sáu",
    markerBg: "bg-rose-500 text-white",
    markerBorder: "border-rose-600",
    dividerBg: "bg-rose-100/90 text-rose-950",
    dividerBorder: "border-rose-300",
    dividerTopBorder: "border-t-2 border-t-rose-500",
    badgeBg: "bg-rose-600 text-white",
    daySlotTint: "bg-rose-50/15",
  },
  // 6: Thứ 7 (Cam đậm / Orange)
  {
    weekday: "T7",
    name: "Thứ bảy",
    markerBg: "bg-orange-500 text-white",
    markerBorder: "border-orange-600",
    dividerBg: "bg-orange-100/90 text-orange-950",
    dividerBorder: "border-orange-300",
    dividerTopBorder: "border-t-2 border-t-orange-500",
    badgeBg: "bg-orange-600 text-white",
    daySlotTint: "bg-orange-50/15",
  },
];

export const MobileVerticalGantt: React.FC<MobileVerticalGanttProps> = ({
  viewMode,
  currentMonth,
  currentDate,
  rooms,
  onBookingClick,
  onBlockClick,
  scrollTrigger = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nowY, setNowY] = useState<number | null>(null);
  const [nowTimeStr, setNowTimeStr] = useState<string>("");
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(() => (typeof Date.now === "function" ? Date.now() : 0));
  const hasInitialScrolled = useRef<boolean>(false);

  const vnToday = useMemo(() => getVnToday(), []);
  const isMonth = viewMode === "month";

  // Sizing
  const slotNormal = MOBILE_SLOT_HEIGHT_NORMAL;
  const slotNight = MOBILE_SLOT_HEIGHT_NIGHT;
  const dayHeight = MOBILE_TOTAL_DAY_HEIGHT + (isMonth ? DAY_HEADER_HEIGHT : 0);

  // Generate days array
  const days = useMemo(() => {
    if (!isMonth) {
      const dObj = new Date(`${currentDate}T12:00:00`);
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
          dayOfWeek: dObj.getDay(), // 0: CN, 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7
        },
      ];
    }

    const [y, m] = currentMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const result = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentMonth}-${String(d).padStart(2, "0")}`;
      const dObj = new Date(`${dateStr}T12:00:00`);
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
        dayOfWeek: dObj.getDay(),
      });
    }

    return result;
  }, [isMonth, currentMonth, currentDate, vnToday]);

  const timelineStartMs = days[0]?.dayStartMs || 0;
  const timelineEndMs = days[days.length - 1]?.dayEndMs || 0;
  const totalTimelineHeight = days.length * dayHeight;

  // Convert timeMs to Y offset
  const timeToTimelineY = (timeMs: number): number => {
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
    const headerOffset = isMonth ? (dayIdx + 1) * DAY_HEADER_HEIGHT : 0;
    const daySlotOffset = timeToDayOffset(clamped, day.dayStartMs, slotNormal, slotNight);
    return dayIdx * MOBILE_TOTAL_DAY_HEIGHT + headerOffset + daySlotOffset;
  };

  // Track live real-time position
  useEffect(() => {
    const updateNow = () => {
      const nowMs = Date.now();
      setCurrentTimeMs(nowMs);
      const vnNow = new Date(nowMs + 7 * 3600 * 1000);

      if (nowMs >= timelineStartMs && nowMs <= timelineEndMs) {
        const y = timeToTimelineY(nowMs);
        setNowY(y);
        const h = vnNow.getUTCHours();
        const m = vnNow.getUTCMinutes();
        setNowTimeStr(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      } else {
        setNowY(null);
        setNowTimeStr("");
      }
    };

    updateNow();
    const interval = setInterval(updateNow, 30000);
    return () => clearInterval(interval);
  }, [days, timelineStartMs, timelineEndMs]);

  // Smooth scroll to today
  const scrollToToday = () => {
    if (!containerRef.current) return;
    const targetElem = document.getElementById(`mobile-day-${vnToday}`);
    if (targetElem && containerRef.current) {
      const containerTop = containerRef.current.getBoundingClientRect().top;
      const elemTop = targetElem.getBoundingClientRect().top;
      const offset = elemTop - containerTop + containerRef.current.scrollTop - (HEADER_HEIGHT + 10); // account for sticky header

      containerRef.current.scrollTo({
        top: Math.max(0, offset),
        behavior: "smooth",
      });
    }
  };

  // Scroll to today on trigger
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
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isMonth, days]);

  // Check occupied status for room header
  const roomOccupiedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    rooms.forEach((r) => {
      const occupied = r.bookings.some((b) => {
        const start = new Date(b.checkinAt).getTime();
        const end = new Date(b.checkoutAt).getTime();
        return currentTimeMs >= start && currentTimeMs <= end && b.status !== "cancelled";
      });
      map.set(r.id, occupied);
    });
    return map;
  }, [rooms, currentTimeMs]);

  return (
    <div className="w-full flex flex-col space-y-2.5">
      {/* Top Mobile Bar with Quick Controls */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {isMonth ? "Gantt Tháng (Lướt dọc)" : "Gantt Ngày (24h)"}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            ({rooms.length} phòng)
          </span>
        </div>

        {nowY !== null && (
          <button
            onClick={scrollToToday}
            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            title="Cuộn tới thời gian hiện tại"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>Bây giờ ({nowTimeStr})</span>
          </button>
        )}
      </div>

      {/* Main Gantt Scroll Container */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Scrollable Viewport with Sticky Headers (Tối ưu phần cứng: loại bỏ scroll-smooth trên CSS container để tránh giật lag khi touch) */}
        <div
          ref={containerRef}
          className="relative overflow-auto max-h-[72vh] min-h-[500px] overscroll-contain select-none"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x pan-y",
            willChange: "scroll-position",
            transform: "translateZ(0)",
          }}
        >
          <div
            className="relative"
            style={{
              width: `${TIME_COL_WIDTH + rooms.length * ROOM_COL_WIDTH}px`,
              minWidth: "100%",
              height: `${totalTimelineHeight + HEADER_HEIGHT}px`,
            }}
          >
            {/* ================= STICKY ROOM HEADER ROW (Loại bỏ backdrop-blur để cuộn mượt 60fps trên mobile) ================= */}
            <div className="sticky top-0 z-30 flex bg-white border-b border-slate-200 shadow-xs">
              {/* Corner: Time / Date Header */}
              <div
                className="sticky left-0 z-40 bg-slate-50 border-r border-slate-200 flex flex-col items-center justify-center px-1 text-center shadow-[2px_0_4px_rgba(0,0,0,0.04)] shrink-0"
                style={{ width: `${TIME_COL_WIDTH}px`, height: `${HEADER_HEIGHT}px` }}
              >
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight">
                  Giờ
                </span>
                <span className="text-[9px] text-emerald-700 font-mono font-bold leading-tight">
                  {isMonth ? "Tháng" : "24h"}
                </span>
              </div>

              {/* Room Column Headers (chỉ hiển thị số phòng 101, 102...) */}
              {rooms.map((room, idx) => {
                const isOccupied = roomOccupiedMap.get(room.id);
                const colorPalette = ROOM_HEADER_PALETTES[idx % ROOM_HEADER_PALETTES.length];
                return (
                  <div
                    key={room.id}
                    className="border-r border-slate-200 flex items-center justify-center p-0.5 bg-white shrink-0"
                    style={{ width: `${ROOM_COL_WIDTH}px`, height: `${HEADER_HEIGHT}px` }}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg border font-mono font-extrabold flex items-center justify-center text-[11px] shadow-2xs ${colorPalette}`}
                      title={`Phòng ${room.roomNumber} (Tầng ${room.floor}) - ${isOccupied ? "Đang có khách" : "Trống"}`}
                    >
                      {room.roomNumber}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ================= TIMELINE GRID BODY ================= */}
            <div className="relative flex" style={{ height: `${totalTimelineHeight}px` }}>
              {/* 1. LEFT STICKY TIME COLUMN */}
              <div
                className="sticky left-0 z-20 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 select-none shadow-[2px_0_4px_rgba(0,0,0,0.04)]"
                style={{ width: `${TIME_COL_WIDTH}px`, height: `${totalTimelineHeight}px` }}
              >
                {days.map((day) => {
                  const dayTheme = DAY_OF_WEEK_THEMES[day.dayOfWeek];
                  return (
                    <div
                      key={day.dateStr}
                      className="flex flex-col"
                      style={{
                        contentVisibility: isMonth ? "auto" : "visible",
                        containIntrinsicSize: isMonth ? `${dayHeight}px` : "auto",
                      }}
                    >
                      {/* Day Header Marker in Column (7 ngày 7 màu riêng biệt, không nhấp nháy) */}
                      {isMonth && (
                        <div
                          id={`mobile-day-${day.dateStr}`}
                          className={`h-[32px] border-b flex flex-col items-center justify-center px-0.5 font-mono text-[9px] font-bold leading-tight ${
                            day.isToday
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                              : `${dayTheme.markerBg} ${dayTheme.markerBorder}`
                          }`}
                        >
                          <div className="flex items-center gap-0.5">
                            <span className="uppercase text-[8.5px] font-extrabold">{day.weekday}</span>
                            {day.isToday && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                            )}
                          </div>
                          <span className="text-[7.5px] font-mono opacity-90">{day.dateFormatted}</span>
                        </div>
                      )}

                      {/* 19 Slots (chiều cao giảm 50%: 26px ngày / 42px đêm) */}
                      {TIMELINE_SLOTS.map((slot) => {
                        const height = slot.isNight ? slotNight : slotNormal;
                        const isKeyHour = [9, 12, 15, 21].includes(slot.hour);

                        return (
                          <div
                            key={slot.id}
                            className={`border-b relative flex flex-col items-center justify-center px-0.5 font-mono ${
                              slot.isNight
                                ? "bg-indigo-50/80 text-indigo-900 font-extrabold border-slate-200"
                                : `border-slate-200 ${
                                    isKeyHour
                                      ? slot.hour === 21
                                        ? "text-indigo-700 font-bold bg-indigo-50/30"
                                        : slot.hour === 15
                                        ? "text-amber-700 font-bold bg-amber-50/30"
                                        : slot.hour === 12
                                        ? "text-sky-700 font-bold bg-sky-50/30"
                                        : "text-emerald-700 font-bold bg-emerald-50/30"
                                      : "text-slate-600 bg-white"
                                  }`
                            }`}
                            style={{ height: `${height}px` }}
                          >
                            {slot.isNight ? (
                              <div className="flex flex-col items-center leading-tight">
                                <span className="text-[8px] font-bold tracking-tight">01h-07h</span>
                                <span className="text-[7px] text-indigo-600 font-semibold">Đêm</span>
                              </div>
                            ) : (
                              <span className="text-[9.5px] tracking-tight leading-none">{slot.label}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* 2. ROOM COLUMNS TRACKS */}
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="relative border-r border-slate-200 shrink-0 bg-white"
                  style={{
                    width: `${ROOM_COL_WIDTH}px`,
                    height: `${totalTimelineHeight}px`,
                  }}
                >
                  {/* Days and Hour Rows Background (Tối ưu content-visibility để bỏ qua vẽ DOM ngoài viewport) */}
                  {days.map((day) => {
                    const dayTheme = DAY_OF_WEEK_THEMES[day.dayOfWeek];
                    return (
                      <div
                        key={day.dateStr}
                        className={`flex flex-col ${dayTheme.daySlotTint}`}
                        style={{
                          contentVisibility: isMonth ? "auto" : "visible",
                          containIntrinsicSize: isMonth ? `${dayHeight}px` : "auto",
                        }}
                      >
                        {/* Day Header divider row (7 màu, không nhấp nháy) */}
                        {isMonth && (
                          <div
                            className={`h-[32px] border-b flex items-center justify-center px-0.5 text-[8.5px] font-bold ${
                              dayTheme.dividerBorder
                            } ${dayTheme.dividerTopBorder} ${
                              day.isToday
                                ? "bg-emerald-100 text-emerald-950 border-t-2 border-t-emerald-600"
                                : dayTheme.dividerBg
                            }`}
                          >
                            {day.isToday ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[7.5px] font-extrabold uppercase tracking-wider shadow-2xs">
                                Nay
                              </span>
                            ) : (
                              <span className={`px-1 py-0.5 rounded text-[7.5px] font-mono font-bold shadow-2xs ${dayTheme.badgeBg}`}>
                                {day.dateFormatted}
                              </span>
                            )}
                          </div>
                        )}

                        {/* 19 Slot Rows */}
                        {TIMELINE_SLOTS.map((slot) => {
                          const height = slot.isNight ? slotNight : slotNormal;
                          return (
                            <div
                              key={slot.id}
                              className={`border-b ${
                                slot.isNight ? "bg-indigo-50/20 border-slate-200" : "border-slate-100"
                              }`}
                              style={{ height: `${height}px` }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Room Blocks (Bảo trì / Khóa phòng) */}
                  {room.blocks.map((block) => {
                    const blockStart = new Date(block.blockedFrom).getTime();
                    const blockEnd = new Date(block.blockedTo).getTime();
                    if (blockEnd < timelineStartMs || blockStart > timelineEndMs) return null;

                    const startsBefore = blockStart < timelineStartMs;
                    const endsAfter = blockEnd > timelineEndMs;

                    const top = timeToTimelineY(blockStart);
                    const bottom = timeToTimelineY(blockEnd);
                    const durationPx = Math.max(20, bottom - top);

                    return (
                      <div
                        key={block.id}
                        onClick={() => onBlockClick?.(block, room)}
                        className="absolute left-0.5 right-0.5 rounded bg-[repeating-linear-gradient(45deg,rgba(245,158,11,0.22),rgba(245,158,11,0.22)_6px,rgba(251,191,36,0.35)_6px,rgba(251,191,36,0.35)_12px)] bg-amber-50 border-2 border-amber-500 text-amber-950 font-bold p-0.5 flex flex-col justify-between overflow-hidden z-15 shadow-2xs cursor-pointer active:scale-95 transition-all hover:brightness-105"
                        style={{
                          top: `${top}px`,
                          height: `${durationPx}px`,
                        }}
                        title={`🔒 Khóa phòng: ${block.reason || "Bảo trì"}\nThời gian: ${formatDateTimeShort(block.blockedFrom)} → ${formatDateTimeShort(block.blockedTo)}${block.note ? `\nGhi chú: ${block.note}` : ""}\n(Chạm để xem chi tiết / mở khóa)`}
                      >
                        {startsBefore && (
                          <div className="text-[7.5px] text-amber-800 font-extrabold flex items-center gap-0.5 pb-0.5 truncate leading-none">
                            <span>▲ Tiếp</span>
                          </div>
                        )}

                        <div className="flex items-center gap-0.5 font-bold text-amber-950 truncate leading-tight">
                          <span className="text-[9px]">🔒</span>
                          <span className="truncate text-[8.5px] leading-tight">{block.reason || "Khóa"}</span>
                        </div>

                        {durationPx >= 34 && (
                          <span className="text-[7.5px] text-amber-800 font-mono font-bold truncate leading-tight">
                            {formatTimeShort(block.blockedFrom)} - {formatTimeShort(block.blockedTo)}
                          </span>
                        )}

                        {endsAfter && (
                          <div className="text-[7.5px] text-amber-800 font-extrabold flex items-center gap-0.5 pt-0.5 truncate leading-none">
                            <span>▼ Sau</span>
                          </div>
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
                        return null;
                      }
                      effectiveCleanUntilMs = Math.min(cleanUntilMs, blockStartMs);
                    }

                    const top = timeToTimelineY(checkoutMs);
                    const bottom = timeToTimelineY(Math.min(effectiveCleanUntilMs, timelineEndMs));
                    const durationPx = Math.max(12, bottom - top);
                    if (durationPx <= 0) return null;

                    return (
                      <div
                        key={`clean-${booking.id}`}
                        className="absolute left-0.5 right-0.5 rounded-b border-x border-b border-dashed border-amber-400 bg-amber-50/90 text-[8px] text-amber-800 font-bold px-0.5 flex items-center justify-center overflow-hidden z-5 pointer-events-none select-none shadow-2xs"
                        style={{
                          top: `${top}px`,
                          height: `${durationPx}px`,
                        }}
                        title={`Dọn phòng: ${new Date(checkoutMs).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })} - ${new Date(effectiveCleanUntilMs).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                      >
                        <span className="flex items-center gap-0.5 font-bold text-amber-800 truncate leading-tight">
                          🧹 {durationPx >= 18 ? "Dọn" : ""}
                        </span>
                      </div>
                    );
                  })}

                  {/* Booking Bars */}
                  {room.bookings.map((booking) => {
                    const checkinMs = new Date(booking.checkinAt).getTime();
                    const checkoutMs = new Date(booking.checkoutAt).getTime();
                    if (checkoutMs < timelineStartMs || checkinMs > timelineEndMs) return null;

                    const top = timeToTimelineY(checkinMs);
                    const bottom = timeToTimelineY(checkoutMs);
                    const durationPx = Math.max(22, bottom - top);

                    const typeConfig = {
                      hourly: {
                        bg: "bg-gradient-to-b from-emerald-600 to-teal-700 border-emerald-500 shadow-emerald-200/50",
                        dot: "bg-emerald-200",
                        tag: "Giờ",
                        tagColor: "bg-emerald-800/40 text-emerald-100",
                      },
                      overnight: {
                        bg: "bg-gradient-to-b from-indigo-600 to-purple-700 border-indigo-500 shadow-indigo-200/50",
                        dot: "bg-indigo-200",
                        tag: "Đêm",
                        tagColor: "bg-indigo-800/40 text-indigo-100",
                      },
                      dayuse: {
                        bg: "bg-gradient-to-b from-amber-600 to-orange-700 border-amber-500 shadow-amber-200/50",
                        dot: "bg-amber-200",
                        tag: "Ngày",
                        tagColor: "bg-amber-800/40 text-amber-100",
                      },
                      custom: {
                        bg: "bg-gradient-to-b from-fuchsia-600 to-pink-700 border-fuchsia-500 shadow-fuchsia-200/50",
                        dot: "bg-fuchsia-200",
                        tag: "Tuỳ",
                        tagColor: "bg-fuchsia-800/40 text-fuchsia-100",
                      },
                    }[booking.bookingType] || {
                      bg: "bg-slate-700 border-slate-500",
                      dot: "bg-slate-300",
                      tag: "Đặt",
                      tagColor: "bg-slate-800/40 text-slate-100",
                    };

                    const isPending = booking.status === "pending";

                    return (
                      <div
                        key={booking.id}
                        onClick={() => onBookingClick(booking)}
                        className={`absolute left-0.5 right-0.5 rounded border text-white shadow-2xs cursor-pointer transition-all active:scale-[0.98] z-10 p-0.5 px-1 flex flex-col justify-between overflow-hidden ${
                          typeConfig.bg
                        } ${
                          isPending ? "border-dashed border-amber-300 opacity-95" : ""
                        }`}
                        style={{
                          top: `${top}px`,
                          height: `${durationPx}px`,
                        }}
                      >
                        {/* Card Top: Guest Name & Tag */}
                        <div className="flex items-center justify-between gap-0.5 min-w-0">
                          <div className="flex items-center gap-0.5 min-w-0 flex-1">
                            <span className={`w-1 h-1 rounded-full shrink-0 ${typeConfig.dot}`} />
                            <span className="font-bold text-[9px] truncate leading-tight text-white drop-shadow-xs">
                              {booking.guestName}
                            </span>
                          </div>
                          {durationPx < 36 && (
                            <span className={`text-[7px] px-0.5 rounded font-bold shrink-0 leading-none ${typeConfig.tagColor}`}>
                              {typeConfig.tag}
                            </span>
                          )}
                        </div>

                        {/* Card Middle: Time Span */}
                        {durationPx >= 36 && (
                          <div className="font-mono text-[7.5px] text-white/95 font-semibold truncate leading-none">
                            {formatTimeShort(booking.checkinAt)} - {formatTimeShort(booking.checkoutAt)}
                          </div>
                        )}

                        {/* Card Bottom: Price (if height permits) */}
                        {durationPx >= 50 && (
                          <div className="flex items-center justify-between pt-0.5 border-t border-white/25 text-[7.5px] leading-tight">
                            <span className="font-mono font-bold text-amber-200 truncate">
                              {Math.round(Number(booking.totalPrice) / 1000)}k
                            </span>
                            <span className={`text-[7px] px-0.5 rounded font-bold shrink-0 ${typeConfig.tagColor}`}>
                              {typeConfig.tag}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* 3. LIVE 'NOW' HORIZONTAL RED LINE */}
              {nowY !== null && (
                <div
                  className="absolute left-0 right-0 z-25 pointer-events-none flex items-center transition-all duration-1000"
                  style={{ top: `${nowY}px` }}
                >
                  <div
                    className="shrink-0 flex items-center justify-center bg-rose-600 text-white font-extrabold text-[8.5px] font-mono py-0.5 shadow-sm rounded-r z-30"
                    style={{ width: `${TIME_COL_WIDTH}px` }}
                  >
                    {nowTimeStr}
                  </div>

                  <div className="flex-1 h-0.5 bg-rose-600 relative">
                    <div className="absolute right-0 -top-1 w-2 h-2 rounded-full bg-rose-600" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend Footer */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded bg-emerald-600 border border-emerald-500" />
              <span>Giờ</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded bg-indigo-600 border border-indigo-500" />
              <span>Đêm</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded bg-amber-600 border border-amber-500" />
              <span>Ngày</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded bg-fuchsia-600 border border-fuchsia-500" />
              <span>Tuỳ chỉnh</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded border border-dashed border-amber-500 bg-amber-100" />
              <span className="text-amber-800 font-medium">🧹 Dọn (1h)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-3 h-2.5 rounded border border-amber-500 bg-amber-200 flex items-center justify-center text-[8px]">
                🔒
              </span>
              <span className="text-amber-900 font-bold">Khóa phòng</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-[10px] text-indigo-700 font-bold font-mono">🌙 01h-07h</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
            <span>📅 7 ngày trong tuần = 7 màu phân biệt</span>
            <span>•</span>
            <span>💡 Chạm để xem chi tiết</span>
          </div>
        </div>
      </div>
    </div>
  );
};
