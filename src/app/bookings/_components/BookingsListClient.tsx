"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { BookingDetailDrawer } from "@/components/dashboard/BookingDetailDrawer";
import { Booking, GanttBookingItem, Room, BookingsListResponse } from "@/types";
import { BookingsFilterBar } from "./BookingsFilterBar";
import { BookingsTable } from "./BookingsTable";
import { BookingsPagination } from "./BookingsPagination";
import {
  getCachedRoomsClient, setCachedRoomsClient,
  getCachedStaffList, setCachedStaffList,
  getBookingsFilterState, setBookingsFilterState,
} from "@/lib/localCache";
import { apiFetch } from "@/lib/apiClient";
import { subscribeToSyncEvents } from "@/lib/syncEvents";
import { DailyRosterModal } from "@/components/bookings/DailyRosterModal";

interface StaffOption {
  id: number;
  full_name: string;
  role: string;
}

export const BookingsListClient: React.FC = () => {
  const searchParams = useSearchParams();
  const initialSearch = searchParams?.get("search") || searchParams?.get("bookingId") || "";
  const initialDepositStatus = searchParams?.get("depositStatus") || "";
  const autoOpen = searchParams?.get("autoOpen") === "true";

  // Master data for filters
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);

  // Restore persisted filter state from localStorage (30 min TTL)
  const savedFilter = typeof window !== "undefined" ? getBookingsFilterState() : null;

  // Filter states
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(savedFilter?.status ?? "");
  const [depositStatus, setDepositStatus] = useState(initialDepositStatus);
  const [roomId, setRoomId] = useState(savedFilter?.roomId ?? "");
  const [bookingType, setBookingType] = useState(savedFilter?.bookingType ?? "");
  const [createdBy, setCreatedBy] = useState(savedFilter?.createdBy ?? "");
  const [createdFrom, setCreatedFrom] = useState(savedFilter?.createdFrom ?? "");
  const [createdTo, setCreatedTo] = useState(savedFilter?.createdTo ?? "");

  // Sort states (default check-in xa nhất đổ lại: checkin_at DESC)
  const [sortBy, setSortBy] = useState<string>(savedFilter?.sortBy ?? "checkin_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(savedFilter?.sortDir ?? "desc");

  // Pagination states (20 dòng / lần)
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Booking data states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBooking, setSelectedBooking] = useState<GanttBookingItem | null>(null);
  const [isRosterOpen, setIsRosterOpen] = useState<boolean>(false);

  // 1. Fetch master rooms & staff on mount — serve from localStorage cache (TTL 60 min)
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const cachedRooms = getCachedRoomsClient();
        const cachedStaff = getCachedStaffList();

        // Build parallel fetch only for what's missing
        const [roomsRes, staffRes] = await Promise.all([
          cachedRooms ? null : fetch("/api/rooms"),
          cachedStaff ? null : fetch("/api/staff"),
        ]);

        if (cachedRooms) {
          setRooms(cachedRooms);
        } else if (roomsRes?.ok) {
          const data = (await roomsRes.json()) as any;
          const fetched: Room[] = data.rooms || [];
          setRooms(fetched);
          setCachedRoomsClient(fetched);
        }

        if (cachedStaff) {
          setStaffList(cachedStaff);
        } else if (staffRes?.ok) {
          const data = (await staffRes.json()) as any;
          const fetched: StaffOption[] = data.staff || [];
          setStaffList(fetched);
          setCachedStaffList(fetched);
        }
      } catch (err) {
        console.error("Failed to fetch master data for filters:", err);
      }
    };

    fetchMasterData();
  }, []);

  // ETag tracking for Bookings List to eliminate unnecessary D1 reads & re-renders
  const lastEtagRef = useRef<string | null>(null);
  const lastFilterKeyRef = useRef<string>("");

  // 2. Fetch bookings with server-side pagination, search & filters
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const currentFilterKey = `${page}-${pageSize}-${sortBy}-${sortDir}-${search}-${status}-${depositStatus}-${roomId}-${bookingType}-${createdBy}-${createdFrom}-${createdTo}`;
      if (lastFilterKeyRef.current !== currentFilterKey) {
        lastEtagRef.current = null;
        lastFilterKeyRef.current = currentFilterKey;
      }

      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);

      if (search && search.trim().length >= 3) {
        params.set("search", search.trim());
      }
      if (status) params.set("status", status);
      if (depositStatus) params.set("depositStatus", depositStatus);
      if (roomId) params.set("roomId", roomId);
      if (bookingType) params.set("bookingType", bookingType);
      if (createdBy) params.set("createdBy", createdBy);
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);

      const timestamp = Date.now();
      params.set("_t", String(timestamp));

      const headers: Record<string, string> = {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      };
      if (lastEtagRef.current) {
        headers["If-None-Match"] = lastEtagRef.current;
      }

      const res = await apiFetch(`/api/bookings?${params.toString()}`, {
        cache: "no-store",
        headers,
      });

      // 304 Not Modified: Data is identical, keep list, skip re-render
      if (res.status === 304) {
        return;
      }

      if (res.ok) {
        const etag = res.headers.get("ETag");
        if (etag) {
          lastEtagRef.current = etag;
        }
        const data = (await res.json()) as BookingsListResponse;
        const fetched = data.bookings || [];
        setBookings(fetched);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);

        // Auto open if query specified autoOpen and exactly 1 booking matched
        if (autoOpen && fetched.length === 1) {
          handleSelectBooking(fetched[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch bookings list:", err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, search, status, depositStatus, roomId, bookingType, createdBy, createdFrom, createdTo, autoOpen]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Cross-tab real-time sync
  useEffect(() => {
    const unsubscribe = subscribeToSyncEvents((type) => {
      if (type === "BOOKINGS_CHANGED") {
        fetchBookings();
      }
    });
    return unsubscribe;
  }, [fetchBookings]);

  // Tab focus & visibility change sync
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchBookings();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [fetchBookings]);

  // Handle Sort toggle
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setPage(1);
  };

  // Persist filter/sort state to localStorage whenever it changes
  useEffect(() => {
    setBookingsFilterState({ status, roomId, bookingType, createdBy, createdFrom, createdTo, sortBy, sortDir });
  }, [status, roomId, bookingType, createdBy, createdFrom, createdTo, sortBy, sortDir]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setSearch("");
    setStatus("");
    setDepositStatus("");
    setRoomId("");
    setBookingType("");
    setCreatedBy("");
    setCreatedFrom("");
    setCreatedTo("");
    setSortBy("checkin_at");
    setSortDir("desc");
    setPage(1);
  };

  // Handle row selection -> open BookingDetailDrawer
  const handleSelectBooking = (b: Booking) => {
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
      instagram: b.instagram,
      facebook: b.facebook,
      closingNote: b.closing_note,
      note: b.note,
      // Control fields
      createdAt: b.created_at,
      createdByStaffId: b.created_by_staff_id,
      createdByStaffName: b.created_by_staff_name,
      updatedAt: b.updated_at,
      updatedByStaffId: b.updated_by_staff_id,
      updatedByStaffName: b.updated_by_staff_name,
      modNo: b.mod_no,
      // No-Show and Refund tracking
      noShowAt: b.no_show_at,
      noShowBy: b.no_show_by,
      noShowByStaffName: b.no_show_by_staff_name,
      noShowReason: b.no_show_reason,
      refundAmount: b.refund_amount,
      originalPrice: b.original_price,
      // Deposit tracking
      isDeposit: b.is_deposit,
      depositAmount: b.deposit_amount,
      paidAmount: b.paid_amount,
      remainingAmount: b.remaining_amount,
      depositDueDate: b.deposit_due_date,
      depositStatus: b.deposit_status,
      depositPaidAt: b.deposit_paid_at,
      depositReminderSentAt: b.deposit_reminder_sent_at,
      remainingPaidAt: b.remaining_paid_at,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Danh Sách Đặt Phòng
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Tra cứu và quản lý lịch sử đặt phòng với bộ lọc đa chiều & phân trang tự động
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="md"
            variant="outline"
            className="border-emerald-600/30 text-emerald-800 hover:bg-emerald-50 shadow-xs font-bold"
            onClick={() => setIsRosterOpen(true)}
            leftIcon={
              <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          >
            Lịch Check-in / Out Ngày
          </Button>

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
      </div>

      {/* Filter & Search Bar */}
      <BookingsFilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        status={status}
        onStatusChange={(val) => {
          setStatus(val);
          setPage(1);
        }}
        depositStatus={depositStatus}
        onDepositStatusChange={(val) => {
          setDepositStatus(val);
          setPage(1);
        }}
        roomId={roomId}
        onRoomChange={(val) => {
          setRoomId(val);
          setPage(1);
        }}
        bookingType={bookingType}
        onBookingTypeChange={(val) => {
          setBookingType(val);
          setPage(1);
        }}
        createdBy={createdBy}
        onCreatedByChange={(val) => {
          setCreatedBy(val);
          setPage(1);
        }}
        createdFrom={createdFrom}
        onCreatedFromChange={(val) => {
          setCreatedFrom(val);
          setPage(1);
        }}
        createdTo={createdTo}
        onCreatedToChange={(val) => {
          setCreatedTo(val);
          setPage(1);
        }}
        onResetFilters={handleResetFilters}
        rooms={rooms}
        staffList={staffList}
      />

      {/* Table & Pagination Wrapper */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500 font-semibold">Đang tải danh sách đặt phòng...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-24 text-center space-y-2">
            <div className="text-3xl">🔍</div>
            <p className="text-sm font-bold text-slate-800">Không tìm thấy lượt đặt phòng nào</p>
            <p className="text-xs text-slate-500 font-medium">
              Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại các tiêu chí bộ lọc.
            </p>
            {(search || roomId || bookingType || createdBy || createdFrom || createdTo) && (
              <button
                onClick={handleResetFilters}
                className="mt-2 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs text-emerald-800 font-bold transition-colors cursor-pointer shadow-xs"
              >
                Đặt lại tất cả bộ lọc
              </button>
            )}
          </div>
        ) : (
          <>
            <BookingsTable
              bookings={bookings}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              onSelectBooking={handleSelectBooking}
            />

            <BookingsPagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </>
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
          onBookingUpdated={() => {
            fetchBookings();
          }}
        />
      )}

      {/* Daily Operational Roster Modal (Check-in & Check-out Dispatch) */}
      <DailyRosterModal
        isOpen={isRosterOpen}
        onClose={() => setIsRosterOpen(false)}
        onSelectBooking={(ganttItem) => {
          setSelectedBooking(ganttItem);
        }}
      />
    </div>
  );
};
