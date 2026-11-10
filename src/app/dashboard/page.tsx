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

  // Statistics calculation: Đồng bộ chuẩn công thức Báo cáo tài chính (Finance Report) & Đơn hôm nay
  const stats = useMemo(() => {
    let todayBookingsCount = 0;
    let totalRevenue = 0;
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

        // 1. Số booking hôm nay: các booking không hủy, có hoạt động lưu trú trong ngày hôm nay (hoặc ngày đang chọn)
        if (b.status !== "cancelled") {
          const start = new Date(b.checkinAt).getTime();
          const end = new Date(b.checkoutAt).getTime();
          if (start < targetDayEndMs && end > targetDayStartMs) {
            todayBookingsCount++;
          }
        }

        // 2. Doanh thu theo chuẩn Báo cáo tài chính (Finance Report):
        // Quy tắc: Chỉ tính đơn có status === 'confirmed'
        // Tính theo tháng/ngày check-in theo giờ Việt Nam (Asia/Ho_Chi_Minh UTC+7)
        if (b.status === "confirmed") {
          const checkinMs = new Date(b.checkinAt).getTime();
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
    });

    return { todayBookingsCount, totalRevenue };
  }, [roomsData, viewMode, month, date, vnToday]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Quick Summary Stats (Synchronized with Tab) */}
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

        {/* Quick Metrics: Số booking hôm nay, Doanh thu (chỉ Manager) & Nút Mã cửa */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1">
          <div className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs shrink-0">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
              {viewMode === "day" && date !== vnToday ? "Số booking trong ngày" : "Số booking hôm nay"}
            </span>
            <span className="text-base font-extrabold text-amber-700 font-mono tabular-nums">
              {stats.todayBookingsCount} đơn
            </span>
          </div>

          {isManager && (
            <div className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs shrink-0">
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                {viewMode === "month" ? "Doanh thu tháng này" : "Doanh thu ngày"}
              </span>
              <span className="text-base font-extrabold text-teal-700 font-mono tabular-nums">
                {stats.totalRevenue.toLocaleString("vi-VN")} đ
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsDoorCodesModalOpen(true)}
            className="group px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 active:scale-[0.98] border border-emerald-200 hover:border-emerald-300 text-left text-xs shadow-2xs shrink-0 transition-all cursor-pointer flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-emerald-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </span>
            <div>
              <span className="text-emerald-800 block text-[10px] uppercase font-bold tracking-wider">
                Mã cửa
              </span>
              <span className="text-sm font-extrabold text-emerald-950 flex items-center gap-1">
                <span>{isManager ? "Cài đặt & tra cứu" : "Tra cứu & copy"}</span>
                <svg className="w-3.5 h-3.5 text-emerald-700 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </button>
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
            }}
            onBookingUpdated={(updated) => {
              setSelectedBooking(updated);
              fetchData();
            }}
          />
        )}

        {/* Room Lock Creation Modal */}
        <RoomLockModal
          isOpen={isLockModalOpen}
          onClose={() => setIsLockModalOpen(false)}
          onSuccess={() => fetchData()}
          rooms={roomsData}
        />

        {/* LSB-5: live hold (web guest / receptionist) → same commands as the Telegram card */}
        {selectedHold && (
          <HoldSessionDrawer
            hold={selectedHold.hold}
            room={selectedHold.room}
            onClose={() => setSelectedHold(null)}
            onChanged={() => fetchData(true)}
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
        />

        {/* Room Lock Detail Drawer */}
        {selectedBlockData && (
          <RoomLockDetailDrawer
            block={selectedBlockData.block}
            room={selectedBlockData.room}
            onClose={() => setSelectedBlockData(null)}
            onBlockDeleted={() => fetchData()}
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
