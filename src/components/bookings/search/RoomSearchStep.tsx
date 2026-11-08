"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CappingWarning, RoomClass } from "@/types";
import { HourlyFields } from "../HourlyFields";
import { OvernightFields } from "../OvernightFields";
import { DayUseFields } from "../DayUseFields";
import { AvailableRoomCard, type AvailableRoomCardItem } from "./AvailableRoomCard";
import type { SearchResult } from "@/shared/booking-kit/types";
import { Spinner } from "../../ui/Spinner";

export type StandardSearchBookingType = "hourly" | "overnight" | "dayuse";

export interface SearchStayCriteria {
  bookingType: StandardSearchBookingType;
  checkinAt: Date;
  checkoutAt: Date;
  checkinDateStr: string;
  earlyCheckinHours: number;
  lateCheckoutHours: number;
  numGuests: number;
}

interface RoomSearchStepProps {
  hourlySlots?: number[];
  initialCriteria?: Partial<SearchStayCriteria>;
  holdingRoomId: string | null;
  onSelectRoomAndHold: (item: AvailableRoomCardItem, criteria: SearchStayCriteria) => void;
}

const SEARCH_TABS: Array<{
  type: StandardSearchBookingType;
  label: string;
  sublabel: string;
  icon: string;
}> = [
  {
    type: "hourly",
    label: "Theo Giờ",
    sublabel: "Combo 3h–8h (08:00–21:00)",
    icon: "⏱️",
  },
  {
    type: "overnight",
    label: "Qua Đêm",
    sublabel: "Ca chuẩn 12h (từ 21:00)",
    icon: "🌙",
  },
  {
    type: "dayuse",
    label: "Theo Ngày",
    sublabel: "15:00 nhận – 12:00 trả",
    icon: "☀️",
  },
];

export const RoomSearchStep: React.FC<RoomSearchStepProps> = ({
  hourlySlots,
  holdingRoomId,
  onSelectRoomAndHold,
}) => {
  // Default date in Vietnam timezone (UTC+7)
  const defaultDate = useMemo(
    () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10),
    []
  );

  const [bookingType, setBookingType] = useState<StandardSearchBookingType>("hourly");
  const [numGuests, setNumGuests] = useState<number>(2);
  const [roomClassFilter, setRoomClassFilter] = useState<"all" | RoomClass>("all");

  // 1. Theo Giờ inputs (same as /bookings/new)
  const [hourlyDate, setHourlyDate] = useState<string>(defaultDate);
  const [hourlyCheckinHour, setHourlyCheckinHour] = useState<number>(14);
  const [hourlyDuration, setHourlyDuration] = useState<number>(3);

  // 2. Qua Đêm inputs (same as /bookings/new)
  const [overnightDate, setOvernightDate] = useState<string>(defaultDate);
  const [overnightStartHour, setOvernightStartHour] = useState<number>(22);
  const [overnightEarlyHours, setOvernightEarlyHours] = useState<number>(0);
  const [overnightLateHours, setOvernightLateHours] = useState<number>(0);

  // 3. Theo Ngày inputs (same as /bookings/new)
  const [dayuseDate, setDayuseDate] = useState<string>(defaultDate);
  const [dayuseNights, setDayuseNights] = useState<number>(1);
  const [dayuseEarlyHours, setDayuseEarlyHours] = useState<number>(0);
  const [dayuseLateHours, setDayuseLateHours] = useState<number>(0);

  // Search results state
  const [roomsResult, setRoomsResult] = useState<AvailableRoomCardItem[]>([]);
  // LSB-5: "còn N phòng" per overnight shift + Booking Core warnings (admin may book outside the web window)
  const [shiftSummary, setShiftSummary] = useState<NonNullable<SearchResult["shiftSummary"]>>([]);
  const [warnings, setWarnings] = useState<NonNullable<SearchResult["warnings"]>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchedAt, setLastSearchedAt] = useState<string | null>(null);
  const [showUnavailable, setShowUnavailable] = useState<boolean>(false);

  // Compute exact check-in & check-out Date objects from the active bookingType's dedicated fields
  const currentCriteria: SearchStayCriteria = useMemo(() => {
    if (bookingType === "hourly") {
      const d = new Date(`${hourlyDate}T00:00:00`);
      d.setHours(hourlyCheckinHour, 0, 0, 0);
      const out = new Date(d.getTime() + hourlyDuration * 3600 * 1000);
      return {
        bookingType: "hourly",
        checkinAt: d,
        checkoutAt: out,
        checkinDateStr: hourlyDate,
        earlyCheckinHours: 0,
        lateCheckoutHours: 0,
        numGuests,
      };
    }

    if (bookingType === "overnight") {
      const maxEarly = Math.max(0, overnightStartHour - 21);
      const earlyH = Math.min(maxEarly, Math.max(0, overnightEarlyHours));
      const d = new Date(`${overnightDate}T00:00:00`);
      d.setHours(overnightStartHour - earlyH, 0, 0, 0);
      const out = new Date(`${overnightDate}T00:00:00`);
      out.setHours(overnightStartHour + 12 + overnightLateHours, 0, 0, 0);
      return {
        bookingType: "overnight",
        checkinAt: d,
        checkoutAt: out,
        checkinDateStr: overnightDate,
        earlyCheckinHours: earlyH,
        lateCheckoutHours: overnightLateHours,
        numGuests,
      };
    }

    // dayuse
    const earlyH = Math.max(0, dayuseEarlyHours);
    const d = new Date(`${dayuseDate}T15:00:00`);
    d.setHours(15 - earlyH, 0, 0, 0);
    const out = new Date(`${dayuseDate}T15:00:00`);
    out.setDate(out.getDate() + dayuseNights);
    out.setHours(12 + dayuseLateHours, 0, 0, 0);
    return {
      bookingType: "dayuse",
      checkinAt: d,
      checkoutAt: out,
      checkinDateStr: dayuseDate,
      earlyCheckinHours: earlyH,
      lateCheckoutHours: dayuseLateHours,
      numGuests,
    };
  }, [
    bookingType,
    numGuests,
    hourlyDate,
    hourlyCheckinHour,
    hourlyDuration,
    overnightDate,
    overnightStartHour,
    overnightEarlyHours,
    overnightLateHours,
    dayuseDate,
    dayuseNights,
    dayuseEarlyHours,
    dayuseLateHours,
  ]);

  const executeSearch = useCallback(async () => {
    if (
      Number.isNaN(currentCriteria.checkinAt.getTime()) ||
      Number.isNaN(currentCriteria.checkoutAt.getTime()) ||
      currentCriteria.checkoutAt <= currentCriteria.checkinAt
    ) {
      setSearchError("Thời gian nhận và trả phòng chưa hợp lệ.");
      return;
    }

    setLoading(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/availability/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingType: currentCriteria.bookingType,
          checkinAt: currentCriteria.checkinAt.toISOString(),
          checkoutAt: currentCriteria.checkoutAt.toISOString(),
          earlyCheckinHours: currentCriteria.earlyCheckinHours,
          lateCheckoutHours: currentCriteria.lateCheckoutHours,
          numGuests: currentCriteria.numGuests,
          ...(roomClassFilter !== "all" ? { roomClass: roomClassFilter } : {}),
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        setSearchError(data.error || "Không thể tra cứu phòng trống.");
        setRoomsResult([]);
        return;
      }

      setRoomsResult(data.rooms || []);
      setShiftSummary(Array.isArray(data.shiftSummary) ? data.shiftSummary : []);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setLastSearchedAt(data.searchedAt || new Date().toISOString());
    } catch (err) {
      console.error("Search availability error:", err);
      setSearchError("Lỗi kết nối khi tìm phòng trống. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [currentCriteria, roomClassFilter]);

  // Automatically trigger search when criteria change
  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  const availableRooms = useMemo(
    () => roomsResult.filter((r) => r.available && r.price !== null),
    [roomsResult]
  );
  const unavailableRooms = useMemo(
    () => roomsResult.filter((r) => !r.available),
    [roomsResult]
  );

  // Extract cappingWarning from the first room result if hourly
  const cappingWarning: CappingWarning | null = useMemo(() => {
    for (const r of roomsResult) {
      if (r.price?.cappingWarning) return r.price.cappingWarning;
    }
    return null;
  }, [roomsResult]);

  return (
    <div className="space-y-6">
      {/* Step 1 Search Filter Card */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5">
        {/* 1. Booking Type Selector (Strictly 3 types: Theo Giờ / Qua Đêm / Theo Ngày) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Chọn Loại Hình Lưu Trú
            </label>
            <span className="text-[11px] text-slate-500">
              Hệ thống tự động kiểm tra quỹ phòng trống & cộng 1 giờ dọn phòng
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {SEARCH_TABS.map((tab) => {
              const active = bookingType === tab.type;
              return (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => setBookingType(tab.type)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                    active
                      ? "bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-600/15 shadow-xs"
                      : "bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="text-2xl shrink-0">{tab.icon}</span>
                  <div>
                    <div
                      className={`text-sm font-extrabold ${
                        active ? "text-emerald-950" : "text-slate-800"
                      }`}
                    >
                      {tab.label}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {tab.sublabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Dedicated Time Inputs per Booking Type (Identical to /bookings/new) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            2. Chọn Thời Gian Nhận – Trả Phòng
          </label>

          {bookingType === "hourly" && (
            <HourlyFields
              checkinDate={hourlyDate}
              checkinHour={hourlyCheckinHour}
              durationHours={hourlyDuration}
              hourlySlots={hourlySlots}
              cappingWarning={cappingWarning}
              onSwitchBookingType={(targetType) => {
                if (targetType === "overnight") {
                  setOvernightDate(hourlyDate);
                  setBookingType("overnight");
                } else if (targetType === "dayuse") {
                  setDayuseDate(hourlyDate);
                  setBookingType("dayuse");
                }
              }}
              onChangeDate={setHourlyDate}
              onChangeHour={setHourlyCheckinHour}
              onChangeDuration={setHourlyDuration}
            />
          )}

          {bookingType === "overnight" && (
            <OvernightFields
              checkinDate={overnightDate}
              startHour={overnightStartHour}
              earlyCheckinHours={overnightEarlyHours}
              lateCheckoutHours={overnightLateHours}
              onChangeDate={setOvernightDate}
              onChangeStartHour={setOvernightStartHour}
              onChangeEarlyCheckin={setOvernightEarlyHours}
              onChangeLateCheckout={setOvernightLateHours}
            />
          )}

          {bookingType === "overnight" && shiftSummary.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Số phòng còn trống theo ca">
              {shiftSummary.map((sh) => {
                const start = Number(sh.code.split("-")[0]);
                const on = start === overnightStartHour;
                return (
                  <button
                    key={sh.code}
                    type="button"
                    disabled={sh.past}
                    onClick={() => {
                      setOvernightStartHour(start);
                      setOvernightEarlyHours(0);
                      setOvernightLateHours(0);
                    }}
                    className={`min-h-10 px-3 rounded-xl border text-xs font-bold text-left ${
                      on ? "bg-emerald-50 border-emerald-400 text-emerald-900" : "bg-white border-slate-200 text-slate-700 hover:border-emerald-300"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {sh.label}
                    <span className={`block text-[11px] font-semibold ${sh.availableRooms === 0 ? "text-rose-600" : "text-slate-500"}`}>
                      {sh.past ? "Đã qua" : sh.availableRooms === 0 ? "Hết phòng" : `Còn ${sh.availableRooms} phòng`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-0.5">
              {warnings.map((w) => (
                <p key={w.code}>⚠️ {w.message} <span className="text-amber-600">(khách web không đặt được khung này)</span></p>
              ))}
            </div>
          )}

          {bookingType === "dayuse" && (
            <DayUseFields
              checkinDate={dayuseDate}
              nights={dayuseNights}
              earlyCheckinHours={dayuseEarlyHours}
              lateCheckoutHours={dayuseLateHours}
              onChangeDate={setDayuseDate}
              onChangeNights={setDayuseNights}
              onChangeEarlyCheckin={setDayuseEarlyHours}
              onChangeLateCheckout={setDayuseLateHours}
            />
          )}
        </div>

        {/* 3. Guest Count & Room Class Filter + Refresh Search CTA */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Guest Count */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Số lượng khách lưu trú
              </label>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setNumGuests(count)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      numGuests === count
                        ? "bg-white text-emerald-800 shadow-2xs border border-emerald-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {count} khách
                  </button>
                ))}
              </div>
              {numGuests > 2 && (
                <p className="text-[11px] text-indigo-700 font-semibold mt-1">
                  💡 Từ khách thứ 3: Chỉ hiển thị hạng phòng Signature (+150k/khách/đêm).
                </p>
              )}
            </div>

            {/* Room Class Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Lọc hạng phòng
              </label>
              <select
                value={roomClassFilter}
                onChange={(e) => setRoomClassFilter(e.target.value as "all" | RoomClass)}
                className="rounded-xl bg-white border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs"
              >
                <option value="all">Tất cả hạng phòng (Haven & Signature)</option>
                <option value="haven">🌿 Chỉ hạng Haven (Tối đa 2 khách)</option>
                <option value="signature">✨ Chỉ hạng Signature (Tối đa 4 khách)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={executeSearch}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
          >
            <span>🔍</span>
            <span>{loading ? "Đang tìm phòng..." : "Làm mới kết quả tìm phòng"}</span>
          </button>
        </div>
      </div>

      {/* Results Section */}
      {searchError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2.5">
          <span>⚠️</span>
          <span>{searchError}</span>
        </div>
      )}

      {loading ? (
        <div className="h-64 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 font-medium">
            Đang kiểm tra phòng trống & tính giá niêm yết...
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Available Rooms Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-extrabold">
                {availableRooms.length} phòng trống
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Danh sách phòng khả dụng & giá niêm yết
              </h2>
            </div>

            {lastSearchedAt && (
              <span className="text-[11px] text-slate-500">
                Bấm <strong>“Chọn phòng này”</strong> để khóa giữ phòng trong 15 phút
              </span>
            )}
          </div>

          {availableRooms.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center space-y-2 shadow-xs">
              <div className="text-3xl">🏨</div>
              <h3 className="text-base font-extrabold text-slate-900">
                Không có phòng trống trong khung giờ này
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Tất cả các phòng phù hợp đã có lịch đặt, đang trong 1 giờ dọn phòng hoặc đang được giữ tạm 15 phút. Vui lòng thử đổi khung giờ hoặc kiểm tra lý do bên dưới.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableRooms.map((item) => (
                <AvailableRoomCard
                  key={item.room.id}
                  item={item}
                  checkinAt={currentCriteria.checkinAt}
                  checkoutAt={currentCriteria.checkoutAt}
                  numGuests={currentCriteria.numGuests}
                  holdingRoomId={holdingRoomId}
                  onSelectRoom={(selected) => onSelectRoomAndHold(selected, currentCriteria)}
                  earlyHours={bookingType === "overnight" ? overnightEarlyHours : 0}
                  lateHours={bookingType === "overnight" ? overnightLateHours : 0}
                  onPickAddon={
                    bookingType === "overnight"
                      ? (type, hours) => (type === "early_checkin" ? setOvernightEarlyHours(hours) : setOvernightLateHours(hours))
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* Unavailable / Busy Rooms Collapsible Section */}
          {unavailableRooms.length > 0 && (
            <div className="rounded-2xl bg-slate-100/80 border border-slate-200/90 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowUnavailable((prev) => !prev)}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span>🔒</span>
                  <span>
                    Phòng đang bận / không khả dụng trong khung giờ này ({unavailableRooms.length} phòng)
                  </span>
                </span>
                <span className="text-slate-500">
                  {showUnavailable ? "Thu gọn ▲" : "Xem lý do ▼"}
                </span>
              </button>

              {showUnavailable && (
                <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unavailableRooms.map((item) => (
                    <div
                      key={item.room.id}
                      className="p-3 rounded-xl bg-white/80 border border-slate-200/90 space-y-1.5 opacity-85"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800">
                          {item.room.name} ({item.room.room_class.toUpperCase()})
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                          Không khả dụng
                        </span>
                      </div>
                      {item.reasons.map((r, idx) => (
                        <p key={idx} className="text-[11px] text-rose-700 leading-snug">
                          • {r.message}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

