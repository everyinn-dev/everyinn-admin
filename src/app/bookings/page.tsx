"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { BookingDetailDrawer } from "@/components/dashboard/BookingDetailDrawer";
import { Booking, GanttBookingItem } from "@/types";

export default function BookingsListPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<GanttBookingItem | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const url = statusFilter === "all" ? "/api/bookings?limit=100" : `/api/bookings?status=${statusFilter}&limit=100`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as any;
        setBookings(data.bookings || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const filteredBookings = bookings.filter((b) => {
    const matchSearch =
      b.member_name.toLowerCase().includes(search.toLowerCase()) ||
      b.member_phone.includes(search) ||
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      (b.room_name && b.room_name.toLowerCase().includes(search.toLowerCase()));

    return matchSearch;
  });

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Danh Sách Đặt Phòng
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Quản lý toàn bộ lịch sử và danh sách đặt phòng tại Every Inn Vạn Hạnh
            </p>
          </div>

          <Link href="/bookings/new">
            <Button
              size="md"
              variant="primary"
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Tạo Đặt Phòng Mới
            </Button>
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 rounded-2xl bg-[#0d131f] border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="w-full sm:w-80 relative">
            <input
              type="text"
              placeholder="Tìm theo tên, SĐT, mã đặt hoặc phòng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-4 py-2 pl-9 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-slate-700 text-white font-semibold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              Tất cả ({bookings.length})
            </button>
            <button
              onClick={() => setStatusFilter("confirmed")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === "confirmed"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              Đã xác nhận
            </button>
            <button
              onClick={() => setStatusFilter("cancelled")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === "cancelled"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              Đã hủy
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="rounded-2xl bg-[#0d131f] border border-slate-800 shadow-xl overflow-hidden">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-slate-400">Đang tải danh sách đặt phòng...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-24 text-center text-slate-500 text-sm">
              Không có lượt đặt phòng nào phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0b101a] border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Mã đặt</th>
                    <th className="py-3 px-4">Khách hàng</th>
                    <th className="py-3 px-4">Phòng</th>
                    <th className="py-3 px-4">Loại hình</th>
                    <th className="py-3 px-4">Thời gian lưu trú</th>
                    <th className="py-3 px-4 text-right">Tổng tiền</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredBookings.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-900/40 transition-colors cursor-pointer"
                      onClick={() =>
                        setSelectedBooking({
                          id: b.id,
                          roomId: b.room_id,
                          guestName: b.member_name,
                          phone: b.member_phone,
                          bookingType: b.booking_type,
                          checkinAt: b.checkin_at,
                          checkoutAt: b.checkout_at,
                          totalPrice: b.total_price,
                          status: b.status,
                          note: b.note,
                        })
                      }
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        #{b.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{b.member_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{b.member_phone}</div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {b.room_name || b.room_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge type={b.booking_type} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        <div>{formatDateTime(b.checkin_at)}</div>
                        <div className="text-[11px] text-slate-400">
                          → {formatDateTime(b.checkout_at)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {Number(b.total_price).toLocaleString("vi-VN")} đ
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge status={b.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-xs text-slate-400 hover:text-slate-200 font-semibold px-2 py-1 rounded bg-slate-800">
                          Xem chi tiết
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Slide-in Detail Drawer */}
        {selectedBooking && (
          <BookingDetailDrawer
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onBookingCancelled={() => {
              fetchBookings();
            }}
          />
        )}
      </div>
    </AdminShell>
  );
}
