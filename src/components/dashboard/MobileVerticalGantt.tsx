"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { GanttBookingItem, GanttRoomData } from "@/types";
import { Badge } from "../ui/Badge";
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
  scrollTrigger?: number;
}

const TIME_COL_WIDTH = 68; // px (widened slightly to fit 01h - 07h)
const ROOM_COL_WIDTH = 142; // px
const DAY_HEADER_HEIGHT = 40; // px (header between days in month view)

export const MobileVerticalGantt: React.FC<MobileVerticalGanttProps> = ({
  viewMode,
  currentMonth,
  currentDate,
  rooms,
  onBookingClick,
  scrollTrigger = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nowY, setNowY] = useState<number | null>(null);
  const [nowTimeStr, setNowTimeStr] = useState<string>("");
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
    const result = [];

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
      const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
      const nowMs = Date.now();

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
      const offset = elemTop - containerTop + containerRef.current.scrollTop - 75; // account for sticky header

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
    const now = Date.now();
    const map = new Map<string, boolean>();
    rooms.forEach((r) => {
      const occupied = r.bookings.some((b) => {
        const start = new Date(b.checkinAt).getTime();
        const end = new Date(b.checkoutAt).getTime();
        return now >= start && now <= end && b.status !== "cancelled";
      });
      map.set(r.id, occupied);
    });
    return map;
  }, [rooms]);

  return (
    <div className="w-full flex flex-col space-y-2.5">
      {/* Top Mobile Bar with Quick Controls */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            {isMonth ? "Gantt Tháng (Lướt dọc)" : "Gantt Ngày (24h)"}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            ({rooms.length} phòng)
          </span>
        </div>

        {nowY !== null && (
          <button
            onClick={scrollToToday}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Cuộn tới thời gian hiện tại"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Bây giờ ({nowTimeStr})</span>
          </button>
        )}
      </div>

      {/* Main Gantt Scroll Container */}
      <div className="rounded-2xl bg-[#0d131f] border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Scrollable Viewport with Sticky Headers */}
        <div
          ref={containerRef}
          className="relative overflow-auto max-h-[72vh] min-h-[500px] scroll-smooth overscroll-contain select-none"
        >
          <div
            className="relative"
            style={{
              width: `${TIME_COL_WIDTH + rooms.length * ROOM_COL_WIDTH}px`,
              minWidth: "100%",
              height: `${totalTimelineHeight + 70}px`,
            }}
          >
            {/* ================= STICKY ROOM HEADER ROW ================= */}
            <div className="sticky top-0 z-30 flex bg-[#0c121d] border-b border-slate-800 shadow-md">
              {/* Corner: Time / Date Header */}
              <div
                className="sticky left-0 z-40 bg-[#0a0f18] border-r border-slate-800 flex flex-col items-center justify-center p-2 text-center shadow-[2px_0_6px_rgba(0,0,0,0.3)]"
                style={{ width: `${TIME_COL_WIDTH}px`, height: "70px" }}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Giờ
                </span>
                <span className="text-[9px] text-emerald-400 font-mono font-medium">
                  {isMonth ? "Tháng" : "24h"}
                </span>
              </div>

              {/* Room Column Headers */}
              {rooms.map((room) => {
                const isOccupied = roomOccupiedMap.get(room.id);
                return (
                  <div
                    key={room.id}
                    className="border-r border-slate-800/80 p-2 flex flex-col justify-between bg-[#0c121d]"
                    style={{ width: `${ROOM_COL_WIDTH}px`, height: "70px" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 font-mono font-extrabold text-slate-100 flex items-center justify-center text-xs">
                          {room.roomNumber}
                        </span>
                        <div className="leading-tight">
                          <span className="text-[11px] font-bold text-slate-200 block truncate max-w-[55px]">
                            {room.name}
                          </span>
                          <span className="text-[9px] text-slate-400 block">
                            Tầng {room.floor}
                          </span>
                        </div>
                      </div>

                      <Badge roomClass={room.roomClass} size="sm" className="text-[10px] px-1 py-0" />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                      {isOccupied ? (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          Có khách
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Trống
                        </span>
                      )}

                      <Link
                        href={`/bookings/new?roomId=${room.id}&date=${currentDate}`}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold px-1 rounded hover:bg-emerald-500/10 transition-colors"
                        title="Tạo đặt phòng mới"
                      >
                        + Đặt
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ================= TIMELINE GRID BODY ================= */}
            <div className="relative flex" style={{ height: `${totalTimelineHeight}px` }}>
              {/* 1. LEFT STICKY TIME COLUMN */}
              <div
                className="sticky left-0 z-20 bg-[#0a0f18] border-r border-slate-800 flex flex-col shrink-0 select-none shadow-[2px_0_6px_rgba(0,0,0,0.3)]"
                style={{ width: `${TIME_COL_WIDTH}px`, height: `${totalTimelineHeight}px` }}
              >
                {days.map((day) => (
                  <div key={day.dateStr} className="flex flex-col">
                    {/* Day Header Marker in Column */}
                    {isMonth && (
                      <div
                        id={`mobile-day-${day.dateStr}`}
                        className={`h-[40px] border-b flex flex-col items-center justify-center px-1 font-mono text-[10px] font-bold ${
                          day.isToday
                            ? "bg-emerald-900/50 text-emerald-300 border-emerald-500/60"
                            : "bg-slate-900 text-slate-300 border-slate-700/80"
                        }`}
                      >
                        <span className="uppercase text-[9px]">{day.weekday}</span>
                        <span>{day.dateFormatted}</span>
                      </div>
                    )}

                    {/* 19 Slots */}
                    {TIMELINE_SLOTS.map((slot) => {
                      const height = slot.isNight ? slotNight : slotNormal;
                      const isKeyHour = [9, 12, 15, 21].includes(slot.hour);

                      return (
                        <div
                          key={slot.id}
                          className={`border-b relative flex flex-col items-center justify-center px-1 font-mono text-[11px] ${
                            slot.isNight
                              ? "bg-indigo-950/40 text-indigo-300 font-extrabold border-slate-700/80"
                              : `border-slate-800/70 ${
                                  isKeyHour
                                    ? slot.hour === 21
                                      ? "text-indigo-400 font-bold"
                                      : slot.hour === 15
                                      ? "text-amber-400 font-bold"
                                      : slot.hour === 12
                                      ? "text-sky-400 font-bold"
                                      : "text-emerald-400 font-bold"
                                    : "text-slate-400"
                                }`
                          }`}
                          style={{ height: `${height}px` }}
                        >
                          {slot.isNight ? (
                            <div className="flex flex-col items-center leading-tight">
                              <span className="text-[10px]">🌙 01h-07h</span>
                              <span className="text-[8px] text-indigo-400/80">Đêm</span>
                            </div>
                          ) : (
                            <span>{slot.label}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* 2. ROOM COLUMNS TRACKS */}
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="relative border-r border-slate-800/80 shrink-0 bg-slate-950/20"
                  style={{
                    width: `${ROOM_COL_WIDTH}px`,
                    height: `${totalTimelineHeight}px`,
                  }}
                >
                  {/* Days and Hour Rows Background */}
                  {days.map((day) => (
                    <div key={day.dateStr} className="flex flex-col">
                      {/* Day Header divider row */}
                      {isMonth && (
                        <div
                          className={`h-[40px] border-b flex items-center px-2 text-[10px] font-bold ${
                            day.isToday
                              ? "bg-emerald-950/30 text-emerald-300 border-emerald-500/50"
                              : "bg-slate-900/60 text-slate-400 border-slate-700/80"
                          }`}
                        >
                          <span>
                            {day.weekday}, {day.dateFormatted}
                          </span>
                          {day.isToday && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-extrabold">
                              Hôm nay
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
                            className={`border-b relative group ${
                              slot.isNight ? "bg-indigo-950/15 border-slate-700/60" : "border-slate-800/60"
                            }`}
                            style={{ height: `${height}px` }}
                          >
                            {/* Tap Slot to Book */}
                            <Link
                              href={`/bookings/new?roomId=${room.id}&date=${day.dateStr}&hour=${slot.hour}`}
                              className="absolute inset-0 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/5 transition-opacity"
                              title={`Đặt phòng ${room.roomNumber} lúc ${slot.label}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Room Blocks (Bảo trì / Giữ phòng) */}
                  {room.blocks.map((block) => {
                    const blockStart = new Date(block.blockedFrom).getTime();
                    const blockEnd = new Date(block.blockedTo).getTime();
                    if (blockEnd < timelineStartMs || blockStart > timelineEndMs) return null;

                    const top = timeToTimelineY(blockStart);
                    const bottom = timeToTimelineY(blockEnd);
                    const durationPx = Math.max(26, bottom - top);

                    return (
                      <div
                        key={block.id}
                        className="absolute left-1 right-1 rounded-lg bg-amber-950/90 border border-amber-500/50 text-[10px] text-amber-200 font-medium p-1 flex flex-col justify-center overflow-hidden z-10 shadow-sm"
                        style={{
                          top: `${top}px`,
                          height: `${durationPx}px`,
                        }}
                        title={`Khóa phòng: ${block.reason || "Bảo trì"}`}
                      >
                        <div className="flex items-center gap-1 font-bold text-amber-300 truncate">
                          <span>🔒</span>
                          <span className="truncate">{block.reason || "Bảo trì"}</span>
                        </div>
                        <span className="text-[9px] opacity-80 font-mono">
                          {formatTimeShort(block.blockedFrom)} - {formatTimeShort(block.blockedTo)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Turnover / Cleaning Buffer Bars (1h after checkout) */}
                  {room.bookings.map((booking) => {
                    if (booking.status === "cancelled") return null;
                    const checkoutMs = new Date(booking.checkoutAt).getTime();
                    const cleanUntilMs = checkoutMs + 60 * 60 * 1000;
                    if (cleanUntilMs < timelineStartMs || checkoutMs > timelineEndMs) return null;

                    const top = timeToTimelineY(checkoutMs);
                    const bottom = timeToTimelineY(Math.min(cleanUntilMs, timelineEndMs));
                    const durationPx = Math.max(14, bottom - top);

                    return (
                      <div
                        key={`clean-${booking.id}`}
                        className="absolute left-1 right-1 rounded-b-lg border-x border-b border-dashed border-amber-500/70 bg-amber-500/15 text-[9px] text-amber-300 font-medium px-1 flex items-center justify-center overflow-hidden z-5 pointer-events-none select-none shadow-sm"
                        style={{
                          top: `${top}px`,
                          height: `${durationPx}px`,
                        }}
                        title={`Dọn phòng: 1h sau trả phòng (#${booking.id})`}
                      >
                        <span className="flex items-center gap-1 font-bold text-amber-200">
                          🧹 {durationPx >= 28 ? "Dọn phòng" : "Dọn"}
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
                    const durationPx = Math.max(36, bottom - top);

                    const typeConfig = {
                      hourly: {
                        bg: "bg-gradient-to-b from-emerald-600/95 to-teal-700/95 border-emerald-400/60 shadow-emerald-950/40",
                        dot: "bg-emerald-300",
                        tag: "Giờ",
                        tagColor: "bg-emerald-500/25 text-emerald-200",
                      },
                      overnight: {
                        bg: "bg-gradient-to-b from-indigo-600/95 to-purple-700/95 border-indigo-400/60 shadow-indigo-950/40",
                        dot: "bg-indigo-300",
                        tag: "Đêm",
                        tagColor: "bg-indigo-500/25 text-indigo-200",
                      },
                      dayuse: {
                        bg: "bg-gradient-to-b from-amber-600/95 to-orange-700/95 border-amber-400/60 shadow-amber-950/40",
                        dot: "bg-amber-300",
                        tag: "Ngày",
                        tagColor: "bg-amber-500/25 text-amber-200",
                      },
                      custom: {
                        bg: "bg-gradient-to-b from-fuchsia-600/95 to-pink-700/95 border-fuchsia-400/60 shadow-fuchsia-950/40",
                        dot: "bg-fuchsia-300",
                        tag: "Tuỳ",
                        tagColor: "bg-fuchsia-500/25 text-fuchsia-200",
                      },
                    }[booking.bookingType] || {
                      bg: "bg-slate-700 border-slate-500",
                      dot: "bg-slate-300",
                      tag: "Đặt",
                      tagColor: "bg-slate-600 text-slate-200",
                    };

                    const isPending = booking.status === "pending";

                    return (
                      <div
                        key={booking.id}
                        onClick={() => onBookingClick(booking)}
                        className={`absolute left-1 right-1 rounded-lg border text-white shadow-md cursor-pointer transition-all active:scale-[0.98] z-10 p-1.5 flex flex-col justify-between overflow-hidden ${
                          typeConfig.bg
                        } ${
                          isPending ? "border-dashed border-amber-300/80 animate-pulse opacity-90" : ""
                        }`}
                        style={{
                          top: `${top}px`,
                          height: `${durationPx}px`,
                        }}
                      >
                        {/* Card Top: Guest Name & Tag */}
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${typeConfig.dot}`} />
                            <span className="font-bold text-xs truncate leading-tight text-white">
                              {booking.guestName}
                            </span>
                          </div>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-semibold shrink-0 ${typeConfig.tagColor}`}>
                            {typeConfig.tag}
                          </span>
                        </div>

                        {/* Card Middle: Time Span */}
                        <div className="font-mono text-[10px] text-white/95 font-medium truncate mt-0.5">
                          {isMonth
                            ? `${formatDateTimeShort(booking.checkinAt)} → ${formatDateTimeShort(booking.checkoutAt)}`
                            : `${formatTimeShort(booking.checkinAt)} → ${formatTimeShort(booking.checkoutAt)}`}
                        </div>

                        {/* Card Bottom: Price (if height permits) */}
                        {durationPx >= 65 && (
                          <div className="flex items-center justify-between pt-1 border-t border-white/20 text-[10px] mt-0.5">
                            <span className="font-mono font-bold text-amber-200">
                              {Number(booking.totalPrice).toLocaleString("vi-VN")} đ
                            </span>
                            {isPending && (
                              <span className="text-[9px] text-amber-300 font-semibold">
                                Chờ duyệt
                              </span>
                            )}
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
                    className="shrink-0 flex items-center justify-center bg-rose-500 text-white font-extrabold text-[9px] font-mono py-0.5 shadow-md shadow-rose-950/80 rounded-r z-30"
                    style={{ width: `${TIME_COL_WIDTH}px` }}
                  >
                    {nowTimeStr}
                  </div>

                  <div className="flex-1 h-0.5 bg-rose-500 shadow-[0_0_10px_#f43f5e] relative">
                    <div className="absolute right-0 -top-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend Footer */}
        <div className="p-2.5 bg-[#0a0f17] border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-400" />
              <span>Giờ</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded bg-indigo-500 border border-indigo-400" />
              <span>Đêm</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 border border-amber-400" />
              <span>Ngày</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded bg-fuchsia-500 border border-fuchsia-400" />
              <span>Tuỳ chỉnh</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded border border-dashed border-amber-500/80 bg-amber-500/20" />
              <span>🧹 Dọn (1h)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-[10px] text-indigo-300 font-bold font-mono">🌙 01h-07h</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500">
            💡 Chạm vào khối để xem chi tiết
          </div>
        </div>
      </div>
    </div>
  );
};
