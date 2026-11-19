"use client";

import React, { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell, useAdminStaff } from "@/components/layout/AdminShell";
import { DateNavBar } from "@/components/dashboard/DateNavBar";
import { GanttChart } from "@/components/dashboard/GanttChart";
import { MobileRoomCard } from "@/components/dashboard/MobileRoomCard";
import { MobileVerticalGantt } from "@/components/dashboard/MobileVerticalGantt";
import { BookingDetailDrawer } from "@/components/dashboard/BookingDetailDrawer";
import { RoomLockModal } from "@/components/dashboard/RoomLockModal";
import { RoomLockDetailDrawer } from "@/components/dashboard/RoomLockDetailDrawer";
import { HoldSessionDrawer } from "@/components/dashboard/HoldSessionDrawer";
import { DoorCodesModal } from "@/components/door-codes/DoorCodesModal";
import { DailyRosterModal } from "@/components/bookings/DailyRosterModal";
import { Spinner } from "@/components/ui/Spinner";
import { GanttBlockItem, GanttBookingItem, GanttHoldItem, GanttRoomData } from "@/types";
import { getVnToday, getVnCurrentMonth } from "@/lib/timelineUtils";
import { getDashboardPrefs, setDashboardPrefs } from "@/lib/localCache";
import { apiFetch } from "@/lib/apiClient";
import { subscribeToSyncEvents } from "@/lib/syncEvents";


function DashboardContent() {
  const searchParams = useSearchParams();
  const staff = useAdminStaff();
  const isManager = staff?.role === "manager";

  const vnToday = useMemo(() => getVnToday(), []);
  const vnCurrentMonth = useMemo(() => getVnCurrentMonth(), []);

  // Restore UI prefs from localStorage (persistent, no TTL)
  const savedPrefs = typeof window !== "undefined" ? getDashboardPrefs() : null;

  // View mode: Month view (default) vs Day view
  const initialMode = (searchParams.get("view") as "month" | "day") || savedPrefs?.viewMode || "month";
  const [viewMode, setViewMode] = useState<"month" | "day">(initialMode);

  // Month & Day state
  const [month, setMonth] = useState<string>(searchParams.get("month") || vnCurrentMonth);
  const [date, setDate] = useState<string>(searchParams.get("date") || vnToday);

  // Scroll to today trigger
  const [scrollTrigger, setScrollTrigger] = useState<number>(0);

  // Room filter & data (restore from prefs)
  const [roomFilter, setRoomFilter] = useState<"all" | "haven" | "signature">(savedPrefs?.roomFilter ?? "all");
  const [roomsData, setRoomsData] = useState<GanttRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<GanttBookingItem | null>(null);
  const [mobileView, setMobileView] = useState<"gantt" | "cards">("gantt");
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [selectedHold, setSelectedHold] = useState<{ hold: GanttHoldItem; room: GanttRoomData } | null>(null);
  const [isDoorCodesModalOpen, setIsDoorCodesModalOpen] = useState(false);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [rosterRefreshSignal, setRosterRefreshSignal] = useState(0);
  const [selectedBlockData, setSelectedBlockData] = useState<{
    block: GanttBlockItem;
    room: GanttRoomData;
  } | null>(null);

  // ETag tracking to avoid redundant D1 scans and re-renders
  const lastEtagRef = useRef<string | null>(null);
  const lastKeyRef = useRef<string>("");
  const lastFetchTimeRef = useRef<number>(0);

  // Dynamic backoff polling interval (20s -> 40s -> 60s khi liên tục 304)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<number>(20000);
  const liveHoldsUntilRef = useRef(0);

  const resetPollingInterval = () => {
    pollingIntervalRef.current = 20000;
  };

  // Persist dashboard prefs whenever viewMode or roomFilter changes
  useEffect(() => {
    setDashboardPrefs({ viewMode, roomFilter });
  }, [viewMode, roomFilter]);

  // Fetch Gantt data according to viewMode with ETag and strict cache-busting
  const fetchData = async (silent = false): Promise<boolean> => {
    try {
      if (!silent) setLoading(true);
      lastFetchTimeRef.current = Date.now();

      const currentKey = viewMode === "month" ? `m-${month}` : `d-${date}`;
      // If user switched month or date, clear ETag to ensure fresh fetch for new view
      if (lastKeyRef.current !== currentKey) {
        lastEtagRef.current = null;
        lastKeyRef.current = currentKey;
      }

      const timestamp = Date.now();
      const url =
        viewMode === "month"
          ? `/api/dashboard/gantt?month=${month}&_t=${timestamp}`
          : `/api/dashboard/gantt?date=${date}&_t=${timestamp}`;

      const headers: Record<string, string> = {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      };
      if (lastEtagRef.current) {
        headers["If-None-Match"] = lastEtagRef.current;
      }

      const res = await apiFetch(url, {
        cache: "no-store",
        headers,
      });

      // HTTP 304 Not Modified: Data is identical, zero DOM re-render, zero DB scanning
      if (res.status === 304) {
        return true;
      }

      if (!res.ok) {
        if (res.status === 401) {
          return false; // apiFetch already cleans cache and dispatches redirect
        }
        throw new Error("Lỗi tải dữ liệu phòng.");
      }

      const etag = res.headers.get("ETag");
      if (etag) {
        lastEtagRef.current = etag;
      }

      const data = (await res.json()) as any;
      setRoomsData(data.rooms || []);
      // LSB-5 poll hint (same rule as Booking Core's x-ei-poll-hint): someone is mid-checkout → refresh every 5 s
      liveHoldsUntilRef.current = Math.max(0, ...(data.rooms || []).flatMap((r: GanttRoomData) => (r.holds ?? []).map((h) => Date.parse(h.expiresAt) || 0)));
      if (liveHoldsUntilRef.current > Date.now()) pollingIntervalRef.current = 5000;
      return false;
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Primary fetch when viewMode / month / date changes
  useEffect(() => {
    resetPollingInterval();
    fetchData();
  }, [viewMode, month, date]);

  // 1. Cross-tab real-time sync (BroadcastChannel): nhận sự kiện thay đổi từ tab khác
  useEffect(() => {
    const unsubscribe = subscribeToSyncEvents((eventType) => {
      if (eventType === "BOOKINGS_CHANGED" || eventType === "ROOM_BLOCKS_CHANGED") {
        resetPollingInterval();
        fetchData(true);
      }
    });
    return unsubscribe;
  }, [viewMode, month, date]);

  // 2. Tab focus & visibility change sync (cooldown 15s, chống gọi lặp đồng thời giữa focus và visibilitychange)
  useEffect(() => {
    const handleActive = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastFetchTimeRef.current >= 15000) {
          resetPollingInterval();
          fetchData(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleActive);
    window.addEventListener("focus", handleActive);
    return () => {
      document.removeEventListener("visibilitychange", handleActive);
      window.removeEventListener("focus", handleActive);
    };
  }, [viewMode, month, date]);

  // 3. Adaptive background polling with backoff: 20s -> 40s -> 60s khi 304, reset về 20s khi có thay đổi
  useEffect(() => {
    let isCancelled = false;

    const schedulePoll = () => {
      if (isCancelled) return;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

      pollTimerRef.current = setTimeout(async () => {
        if (isCancelled) return;
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          const is304 = await fetchData(true);
          if (liveHoldsUntilRef.current > Date.now()) {
            pollingIntervalRef.current = 5000;
          } else if (is304) {
            // Tăng dần chu kỳ khi dữ liệu không đổi: 20s -> 40s -> 60s
            if (pollingIntervalRef.current < 40000) {
              pollingIntervalRef.current = 40000;
            } else if (pollingIntervalRef.current < 60000) {
              pollingIntervalRef.current = 60000;
            }
          } else {
            // Có dữ liệu mới: đưa về chu kỳ thăm dò cơ sở 20s
            pollingIntervalRef.current = 20000;
          }
        }
        schedulePoll();
      }, pollingIntervalRef.current);
    };

    schedulePoll();

    return () => {
      isCancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [viewMode, month, date]);

  const handleViewModeChange = (mode: "month" | "day") => {
    resetPollingInterval();
    setViewMode(mode);
    const newUrl =
      mode === "month"
        ? `/dashboard?view=month&month=${month}`
        : `/dashboard?view=day&date=${date}`;
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", newUrl);
    }
  };

  const handleMonthChange = (newMonth: string) => {
    resetPollingInterval();
    setMonth(newMonth);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/dashboard?view=month&month=${newMonth}`);
    }
  };

  const handleDateChange = (newDate: string) => {
    resetPollingInterval();
    setDate(newDate);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/dashboard?view=day&date=${newDate}`);
    }
  };

  const handleScrollToToday = () => {
    resetPollingInterval();
    // If in month view, fire scroll trigger to animate to today
    if (viewMode === "month") {
      // If currently in a different month, switch to current month first
      if (month !== vnCurrentMonth) {
        setMonth(vnCurrentMonth);
      }
      setScrollTrigger((prev) => prev + 1);
    } else {
      // In day view, jump to today
      handleDateChange(vnToday);
    }
  };

  const handleManualRefresh = () => {
    resetPollingInterval();
    fetchData();
  };

  // Filter rooms
  const filteredRooms = useMemo(() => {
    if (roomFilter === "all") return roomsData;
    return roomsData.filter((r) => r.roomClass === roomFilter);
  }, [roomsData, roomFilter]);

  // Room counts for filter badges
  const roomCounts = useMemo(() => {
    const all = roomsData.length;
    const haven = roomsData.filter((r) => r.roomClass === "haven").length;
    const signature = roomsData.filter((r) => r.roomClass === "signature").length;
    return { all, haven, signature };
  }, [roomsData]);

  // Month revenue comes from Booking Core's revenue matrix (EI-FINANCE-ONTOLOGY-001 ĐN1: room by check-in month +
  // stay charges by day + retained on the closure day) — never recomputed here. Refetched when the gantt data changes.
  const [monthRevenue, setMonthRevenue] = useState<number | null>(null);
  // ETag per month: the gantt polls often, an unchanged ledger answers 304 without Core recomputing anything.
  const revenueEtagRef = useRef<{ month: string; etag: string } | null>(null);
  useEffect(() => {
    if (!isManager || viewMode !== "month") return;
    let cancelled = false;
    const headers: Record<string, string> = {};
    if (revenueEtagRef.current?.month === month) headers["If-None-Match"] = revenueEtagRef.current.etag;
    apiFetch(`/api/finance/revenue-matrix?from=${month}&to=${month}&basis=checkin`, { headers, cache: "no-store" })
      .then(async (res) => {
        if (res.status === 304 || cancelled) return;
        if (!res.ok) return setMonthRevenue(null);
        const body = (await res.json()) as { grandTotal?: number };
        const etag = res.headers.get("ETag");
        revenueEtagRef.current = etag ? { month, etag } : null;
        if (!cancelled) setMonthRevenue(typeof body?.grandTotal === "number" ? body.grandTotal : null);
      })
      .catch(() => {
        if (!cancelled) setMonthRevenue(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isManager, viewMode, month, roomsData]);

  // Statistics calculation: Đơn hôm nay + điều phối nhận/dọn + doanh thu
  const stats = useMemo(() => {
    let todayBookingsCount = 0;
    let totalRevenue = 0;
    let rosterInsCount = 0;
    let rosterOutsCount = 0;
    const seenBookingIds = new Set<string>();

    // Target day boundaries (Vietnam time UTC+7)
    // Nếu ở chế độ xem ngày: theo ngày đang chọn. Nếu ở chế độ xem tháng: theo ngày hôm nay (vnToday)
    const targetDate = viewMode === "day" ? date : vnToday;
    const targetDayStartMs = new Date(`${targetDate}T00:00:00+07:00`).getTime();
    const targetDayEndMs = targetDayStartMs + 24 * 3600 * 1000;

    roomsData.forEach((room) => {
      room.bookings.forEach((b) => {
        if (seenBookingIds.has(b.id)) return;
        seenBookingIds.add(b.id);

        const start = new Date(b.checkinAt).getTime();
        const end = new Date(b.checkoutAt).getTime();

        // 1. Số booking hôm nay: các booking không hủy, có hoạt động lưu trú trong ngày hôm nay (hoặc ngày đang chọn)
        if (b.status !== "cancelled") {
          if (start < targetDayEndMs && end > targetDayStartMs) {
            todayBookingsCount++;
          }
          if (start >= targetDayStartMs && start < targetDayEndMs) {
            rosterInsCount++;
          }
        }

        // 2. Doanh thu & lượt dọn checkout trong ngày (confirmed)
        if (b.status === "confirmed") {
          if (end >= targetDayStartMs && end < targetDayEndMs) {
            rosterOutsCount++;
          }

          const checkinMs = start;
          const vnCheckinIso = new Date(checkinMs + 7 * 3600 * 1000).toISOString();
          const vnCheckinMonth = vnCheckinIso.slice(0, 7); // YYYY-MM
          const vnCheckinDate = vnCheckinIso.slice(0, 10); // YYYY-MM-DD

          if (viewMode === "month") {
            if (vnCheckinMonth === month) {
              totalRevenue += Number(b.totalPrice) || 0;
            }
          } else {
            if (vnCheckinDate === date) {
              totalRevenue += Number(b.totalPrice) || 0;
            }
          }
        }
      });

      (room.blocks ?? []).forEach((bl) => {
        if (bl.blockType === "owner_stay" && bl.status !== "released") {
          const endMs = new Date(bl.blockedTo).getTime();
          if (endMs >= targetDayStartMs && endMs < targetDayEndMs) {
            rosterOutsCount++;
          }
        }
      });
    });

    return { todayBookingsCount, totalRevenue, rosterInsCount, rosterOutsCount };
  }, [roomsData, viewMode, month, date, vnToday]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Quick Summary Stats (Order: Số booking hôm nay -> Mã cửa -> Điều phối ngày -> Doanh Thu) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Bảng Quản Lý Phòng & Tiến Độ (Gantt)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {viewMode === "month"
              ? `Lịch đặt phòng toàn diện theo tháng (${month}) • Gộp giờ đêm 01h-07h trực quan`
              : `Theo dõi chi tiết 24 giờ trong ngày (${date}) • Cập nhật theo thời gian thực`}
          </p>
        </div>

        {/* Quick Action Strip: Số booking hôm nay -> Mã cửa (thu gọn >=30%) -> Điều phối ngày -> Doanh Thu */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* 1. Số booking hôm nay */}
          <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs shrink-0 min-h-[44px] flex flex-col justify-center">
            <span className="text-slate-500 block text-xs font-semibold leading-tight">
              {viewMode === "day" && date !== vnToday ? "Booking trong ngày" : "Số booking hôm nay"}
            </span>
            <span className="text-sm sm:text-base font-extrabold text-amber-700 font-mono tabular-nums leading-tight">
              {stats.todayBookingsCount} đơn
            </span>
          </div>

          {/* 2. Mã cửa (thu gọn ngang >= 30% so với nút cũ) */}
          <button
            type="button"
            onClick={() => setIsDoorCodesModalOpen(true)}
            aria-label="Mở quản lý và tra cứu mã cửa"
            className="min-h-[44px] px-3 py-2 rounded-xl bg-white hover:bg-emerald-50/70 active:scale-[0.98] border border-slate-200 hover:border-emerald-300 text-slate-800 hover:text-emerald-900 shadow-2xs shrink-0 transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <svg className="w-4 h-4 text-emerald-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            <span className="text-xs sm:text-sm font-bold">Mã cửa</span>
          </button>

          {/* 3. Điều phối ngày (mở nhanh DailyRosterModal) */}
          <button
            type="button"
            onClick={() => setIsRosterModalOpen(true)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] border border-emerald-700/30 text-white text-left shadow-xs shrink-0 transition-all cursor-pointer inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <svg className="w-4 h-4 text-emerald-50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <div className="leading-tight">
              <span className="block text-xs sm:text-sm font-bold whitespace-nowrap">Điều phối ngày</span>
              <span className="block text-xs text-emerald-100 tabular-nums whitespace-nowrap">
                {stats.rosterInsCount} nhận · {stats.rosterOutsCount} dọn
              </span>
            </div>
          </button>

          {/* 4. Doanh Thu (chỉ Manager) */}
          {isManager && (
            <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs shrink-0 min-h-[44px] flex flex-col justify-center">
              <span className="text-slate-500 block text-xs font-semibold leading-tight">
                {viewMode === "month" ? "Doanh thu tháng (theo check-in)" : "Giá trị đơn nhận phòng trong ngày"}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-teal-700 font-mono tabular-nums leading-tight">
                {viewMode === "month"
                  ? monthRevenue === null
                    ? "…"
                    : `${monthRevenue.toLocaleString("vi-VN")} đ`
                  : `${stats.totalRevenue.toLocaleString("vi-VN")} đ`}
              </span>
            </div>
          )}
        </div>
      </div>

        {/* Date Navigator with Month/Day Tabs & Quick Scroll */}
        <DateNavBar
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          currentMonth={month}
          onMonthChange={handleMonthChange}
          currentDate={date}
          onDateChange={handleDateChange}
          onScrollToToday={handleScrollToToday}
          roomFilter={roomFilter}
          onFilterChange={setRoomFilter}
          onRefresh={handleManualRefresh}
          isLoading={loading}
          roomCounts={roomCounts}
          onOpenRoomLockModal={() => setIsLockModalOpen(true)}
        />

        {/* Content Display */}
        {loading && roomsData.length === 0 ? (
          <div className="h-96 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center gap-3 shadow-sm">
            <Spinner size="lg" />
            <p className="text-sm text-slate-600 font-medium">Đang tải lịch đặt phòng...</p>
          </div>
        ) : (
          <>
            {/* Desktop Gantt Chart View */}
            <div className="hidden lg:block">
              <GanttChart
                viewMode={viewMode}
                currentMonth={month}
                currentDate={date}
                rooms={filteredRooms}
                scrollTrigger={scrollTrigger}
                onBookingClick={(booking) => setSelectedBooking(booking)}
                onBlockClick={(block, room) => setSelectedBlockData({ block, room })}
                onHoldClick={(hold, room) => setSelectedHold({ hold, room })}
              />
            </div>

            {/* Mobile View: Vertical Gantt Chart (Default) with View Switcher */}
            <div className="lg:hidden space-y-3">
              {/* Header with Title & View Switcher */}
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    {viewMode === "month" ? "Biểu đồ Gantt Tháng" : "Biểu đồ Gantt Ngày"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Cột theo từng phòng • Hàng lướt dọc theo thời gian
                  </p>
                </div>

                {/* View Switcher: Gantt vs Card */}
                <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs shrink-0">
                  <button
                    onClick={() => setMobileView("gantt")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      mobileView === "gantt"
                        ? "bg-white text-emerald-800 border border-slate-200 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Xem biểu đồ Gantt dọc"
                  >
                    📊 Biểu đồ
                  </button>
                  <button
                    onClick={() => setMobileView("cards")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      mobileView === "cards"
                        ? "bg-white text-emerald-800 border border-slate-200 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Xem danh sách dạng thẻ"
                  >
                    📋 Thẻ
                  </button>
                </div>
              </div>

              {mobileView === "gantt" ? (
                <MobileVerticalGantt
                  viewMode={viewMode}
                  currentMonth={month}
                  currentDate={date}
                  rooms={filteredRooms}
                  scrollTrigger={scrollTrigger}
                  onBookingClick={(booking) => setSelectedBooking(booking)}
                  onBlockClick={(block, room) => setSelectedBlockData({ block, room })}
                  onHoldClick={(hold, room) => setSelectedHold({ hold, room })}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredRooms.map((room) => (
                    <MobileRoomCard
                      key={room.id}
                      room={room}
                      currentDate={date}
                      onBookingClick={(booking) => setSelectedBooking(booking)}
                      onBlockClick={(block) => setSelectedBlockData({ block, room })}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Detail Slide-in Drawer */}
        {selectedBooking && (
          <BookingDetailDrawer
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onBookingCancelled={() => {
              fetchData();
              setRosterRefreshSignal((n) => n + 1);
            }}
            onBookingUpdated={(updated) => {
              setSelectedBooking(updated);
              fetchData();
              setRosterRefreshSignal((n) => n + 1);
            }}
          />
        )}

        {/* Room Lock Creation Modal */}
        <RoomLockModal
          isOpen={isLockModalOpen}
          onClose={() => setIsLockModalOpen(false)}
          onSuccess={() => {
            fetchData();
            setRosterRefreshSignal((n) => n + 1);
          }}
          rooms={roomsData}
          isManager={isManager}
        />

        {/* LSB-5: live hold (web guest / receptionist) → same commands as the Telegram card */}
        {selectedHold && (
          <HoldSessionDrawer
            hold={selectedHold.hold}
            room={selectedHold.room}
            onClose={() => setSelectedHold(null)}
            onChanged={() => {
              fetchData(true);
              setRosterRefreshSignal((n) => n + 1);
            }}
          />
        )}

        {/* Shared Door Codes Vault Modal */}
        <DoorCodesModal
          isOpen={isDoorCodesModalOpen}
          onClose={() => setIsDoorCodesModalOpen(false)}
          isManager={isManager}
          initialDate={viewMode === "day" ? date : vnToday}
          preloadedDate={viewMode === "day" ? date : undefined}
          preloadedRooms={viewMode === "day" ? roomsData : undefined}
          onChanged={() => setRosterRefreshSignal((n) => n + 1)}
        />

        {/* Quick Daily Operations Modal (Điều phối ngày) */}
        <DailyRosterModal
          isOpen={isRosterModalOpen}
          onClose={() => setIsRosterModalOpen(false)}
          initialDate={viewMode === "day" ? date : vnToday}
          refreshSignal={rosterRefreshSignal}
          onSelectBooking={(booking) => setSelectedBooking(booking)}
          onOpenDoorCodes={() => setIsDoorCodesModalOpen(true)}
        />

        {/* Room Lock Detail Drawer */}
        {selectedBlockData && (
          <RoomLockDetailDrawer
            block={selectedBlockData.block}
            room={selectedBlockData.room}
            onClose={() => setSelectedBlockData(null)}
            onBlockDeleted={() => {
              fetchData();
              setRosterRefreshSignal((n) => n + 1);
            }}
            isManager={isManager}
          />
        )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AdminShell>
      <Suspense
        fallback={
          <div className="h-96 bg-slate-50 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-600 font-medium">Đang tải bảng phòng...</p>
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </AdminShell>
  );
}
