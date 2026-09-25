"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { DateNavBar } from "@/components/dashboard/DateNavBar";
import { GanttChart } from "@/components/dashboard/GanttChart";
import { MobileRoomCard } from "@/components/dashboard/MobileRoomCard";
import { MobileVerticalGantt } from "@/components/dashboard/MobileVerticalGantt";
import { BookingDetailDrawer } from "@/components/dashboard/BookingDetailDrawer";
import { Spinner } from "@/components/ui/Spinner";
import { GanttBookingItem, GanttRoomData } from "@/types";
import { getVnToday, getVnCurrentMonth } from "@/lib/timelineUtils";


function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const vnToday = useMemo(() => getVnToday(), []);
  const vnCurrentMonth = useMemo(() => getVnCurrentMonth(), []);

  // View mode: Month view (default) vs Day view
  const initialMode = (searchParams.get("view") as "month" | "day") || "month";
  const [viewMode, setViewMode] = useState<"month" | "day">(initialMode);

  // Month & Day state
  const [month, setMonth] = useState<string>(searchParams.get("month") || vnCurrentMonth);
  const [date, setDate] = useState<string>(searchParams.get("date") || vnToday);

  // Scroll to today trigger
  const [scrollTrigger, setScrollTrigger] = useState<number>(0);

  // Room filter & data
  const [roomFilter, setRoomFilter] = useState<"all" | "haven" | "signature">("all");
  const [roomsData, setRoomsData] = useState<GanttRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<GanttBookingItem | null>(null);
  const [mobileView, setMobileView] = useState<"gantt" | "cards">("gantt");

  // Fetch Gantt data according to viewMode
  const fetchData = async () => {
    try {
      setLoading(true);
      const url =
        viewMode === "month"
          ? `/api/dashboard/gantt?month=${month}`
          : `/api/dashboard/gantt?date=${date}`;

      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Lỗi tải dữ liệu phòng.");
      }
      const data = (await res.json()) as any;
      setRoomsData(data.rooms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [viewMode, month, date]);

  const handleViewModeChange = (mode: "month" | "day") => {
    setViewMode(mode);
    const newUrl =
      mode === "month"
        ? `/dashboard?view=month&month=${month}`
        : `/dashboard?view=day&date=${date}`;
    router.replace(newUrl, { scroll: false });
  };

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth);
    router.replace(`/dashboard?view=month&month=${newMonth}`, { scroll: false });
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    router.replace(`/dashboard?view=day&date=${newDate}`, { scroll: false });
  };

  const handleScrollToToday = () => {
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

  // Statistics calculation according to viewMode (Month vs Day)
  const stats = useMemo(() => {
    const totalRooms = roomsData.length;
    let totalBookings = 0;
    let totalRevenue = 0;
    let occupiedCount = 0;
    const now = Date.now();

    roomsData.forEach((room) => {
      totalBookings += room.bookings.length;
      room.bookings.forEach((b) => {
        totalRevenue += b.totalPrice;
        const start = new Date(b.checkinAt).getTime();
        const end = new Date(b.checkoutAt).getTime();
        if (now >= start && now <= end && b.status !== "cancelled") {
          occupiedCount++;
        }
      });
    });

    return { totalRooms, totalBookings, totalRevenue, occupiedCount };
  }, [roomsData]);

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Page Title & Quick Summary Stats (Synchronized with Tab) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Bảng Quản Lý Phòng & Tiến Độ (Gantt)
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {viewMode === "month"
                ? `Lịch đặt phòng toàn diện theo tháng (${month}) • Gộp giờ đêm 01h-07h trực quan`
                : `Theo dõi chi tiết 24 giờ trong ngày (${date}) • Cập nhật theo thời gian thực`}
            </p>
          </div>

          {/* Quick Metrics: Shown by Tab (Tháng or Ngày) */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1">
            <div className="px-3.5 py-2 rounded-xl bg-[#121927] border border-slate-800 text-xs shadow-inner shrink-0">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Đang có khách
              </span>
              <span className="text-base font-extrabold text-amber-400 font-mono">
                {stats.occupiedCount} / {stats.totalRooms} phòng
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-[#121927] border border-slate-800 text-xs shadow-inner shrink-0">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                {viewMode === "month" ? "Lịch đặt tháng này" : "Lịch đặt trong ngày"}
              </span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {stats.totalBookings} lượt
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-[#121927] border border-slate-800 text-xs hidden sm:block shadow-inner shrink-0">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                {viewMode === "month" ? "Doanh thu tháng" : "Doanh thu ngày"}
              </span>
              <span className="text-base font-extrabold text-teal-300 font-mono">
                {stats.totalRevenue.toLocaleString("vi-VN")} đ
              </span>
            </div>
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
          onRefresh={fetchData}
          isLoading={loading}
          roomCounts={roomCounts}
        />

        {/* Content Display */}
        {loading && roomsData.length === 0 ? (
          <div className="h-96 rounded-2xl bg-[#0d131f] border border-slate-800 flex flex-col items-center justify-center gap-3 shadow-xl">
            <Spinner size="lg" />
            <p className="text-sm text-slate-400 font-medium">Đang tải lịch đặt phòng...</p>
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
              />
            </div>

            {/* Mobile View: Vertical Gantt Chart (Default) with View Switcher */}
            <div className="lg:hidden space-y-3">
              {/* Header with Title & View Switcher */}
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">
                    {viewMode === "month" ? "Biểu đồ Gantt Tháng" : "Biểu đồ Gantt Ngày"}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Cột theo từng phòng • Hàng lướt dọc theo thời gian
                  </p>
                </div>

                {/* View Switcher: Gantt vs Card */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs shrink-0">
                  <button
                    onClick={() => setMobileView("gantt")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      mobileView === "gantt"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Xem biểu đồ Gantt dọc"
                  >
                    📊 Biểu đồ
                  </button>
                  <button
                    onClick={() => setMobileView("cards")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      mobileView === "cards"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
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
          />
        )}
      </div>
    </AdminShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-400 font-medium">Đang tải bảng phòng...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
