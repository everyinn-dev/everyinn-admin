"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { DateNavBar } from "@/components/dashboard/DateNavBar";
import { GanttChart } from "@/components/dashboard/GanttChart";
import { MobileRoomCard } from "@/components/dashboard/MobileRoomCard";
import { BookingDetailDrawer } from "@/components/dashboard/BookingDetailDrawer";
import { Spinner } from "@/components/ui/Spinner";
import { GanttBookingItem, GanttRoomData } from "@/types";

export const dynamic = "force-dynamic";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Selected date (defaults to today in Vietnam UTC+7)
  const todayStr = useMemo(() => {
    return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  }, []);

  const [date, setDate] = useState<string>(searchParams.get("date") || todayStr);
  const [roomFilter, setRoomFilter] = useState<"all" | "haven" | "signature">("all");
  const [roomsData, setRoomsData] = useState<GanttRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<GanttBookingItem | null>(null);

  // Fetch Gantt data
  const fetchData = async (targetDate: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dashboard/gantt?date=${targetDate}`);
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
    fetchData(date);
  }, [date]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    router.replace(`/dashboard?date=${newDate}`, { scroll: false });
  };

  // Filter rooms
  const filteredRooms = useMemo(() => {
    if (roomFilter === "all") return roomsData;
    return roomsData.filter((r) => r.roomClass === roomFilter);
  }, [roomsData, roomFilter]);

  // Statistics calculation for the target date
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
        {/* Page Title & Quick Summary Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Bảng Quản Lý Phòng & Tiến Độ (Gantt)
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Theo dõi trực quan phòng trống, giờ nhận/trả và tình trạng khách theo thời gian thực
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1">
            <div className="px-3.5 py-2 rounded-xl bg-[#121927] border border-slate-800 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Đang có khách
              </span>
              <span className="text-base font-extrabold text-amber-400 font-mono">
                {stats.occupiedCount} / {stats.totalRooms} phòng
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-[#121927] border border-slate-800 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Lịch đặt hôm nay
              </span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {stats.totalBookings} lượt
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-[#121927] border border-slate-800 text-xs hidden sm:block">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Doanh thu ngày
              </span>
              <span className="text-base font-extrabold text-teal-300 font-mono">
                {stats.totalRevenue.toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>
        </div>

        {/* Date Navigator & Filters */}
        <DateNavBar
          currentDate={date}
          onDateChange={handleDateChange}
          roomFilter={roomFilter}
          onFilterChange={setRoomFilter}
          onRefresh={() => fetchData(date)}
          isLoading={loading}
        />

        {/* Content Display */}
        {loading && roomsData.length === 0 ? (
          <div className="h-96 rounded-2xl bg-[#0d131f] border border-slate-800 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-400 font-medium">Đang tải lịch đặt phòng...</p>
          </div>
        ) : (
          <>
            {/* Desktop Gantt Chart View */}
            <div className="hidden lg:block">
              <GanttChart
                currentDate={date}
                rooms={filteredRooms}
                onBookingClick={(booking) => setSelectedBooking(booking)}
              />
            </div>

            {/* Mobile Card Grid View */}
            <div className="lg:hidden space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-semibold">
                <span>DANH SÁCH PHÒNG ({filteredRooms.length})</span>
                <span>Chạm thẻ để xem</span>
              </div>
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
            </div>
          </>
        )}

        {/* Detail Slide-in Drawer */}
        {selectedBooking && (
          <BookingDetailDrawer
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onBookingCancelled={() => {
              fetchData(date);
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
