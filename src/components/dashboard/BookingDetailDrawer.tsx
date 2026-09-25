"use client";

import React, { useState } from "react";
import { GanttBookingItem } from "@/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface BookingDetailDrawerProps {
  booking: GanttBookingItem | null;
  onClose: () => void;
  onBookingCancelled?: () => void;
}

export const BookingDetailDrawer: React.FC<BookingDetailDrawerProps> = ({
  booking,
  onClose,
  onBookingCancelled,
}) => {
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!booking) return null;

  const checkin = new Date(booking.checkinAt);
  const checkout = new Date(booking.checkoutAt);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleCancelBooking = async () => {
    try {
      setCancelling(true);
      setErrorMsg("");
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", cancelReason }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể hủy đặt phòng.");
      }

      setShowConfirmCancel(false);
      onBookingCancelled?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi hủy đặt phòng.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div
        className="w-full max-w-md bg-[#111724] border-l border-slate-800 shadow-2xl h-full flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#111724]/95 backdrop-blur-md z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400">
                #{booking.id}
              </span>
              <Badge status={booking.status} size="sm" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mt-1">
              Chi tiết Đặt Phòng
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-5 space-y-6 flex-1">
          {/* Guest Information Card */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Khách hàng
            </span>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-bold text-slate-100">{booking.guestName}</p>
                <p className="text-sm font-mono text-emerald-400 mt-0.5">{booking.phone}</p>
              </div>
              <a
                href={`tel:${booking.phone}`}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <span>📞</span>
                <span>Gọi</span>
              </a>
            </div>

            {/* Social handles */}
            {(booking.instagram || booking.facebook) && (
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 text-xs">
                {booking.instagram && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 font-medium">
                    <span className="text-xs">📸</span>
                    <span>@{booking.instagram}</span>
                  </div>
                )}
                {booking.facebook && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium">
                    <span className="text-xs font-bold text-blue-400">f</span>
                    <span>{booking.facebook}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Booking Details */}
          <div className="space-y-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Lịch đặt & Phòng
            </span>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Loại hình</span>
                <Badge type={booking.bookingType} size="sm" />
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Phòng</span>
                <span className="font-semibold text-slate-200">Phòng {booking.roomId}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Nhận phòng (Check-in):</span>
                <span className="font-semibold text-slate-200">{formatDateTime(checkin)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Trả phòng (Check-out):</span>
                <span className="font-semibold text-slate-200">{formatDateTime(checkout)}</span>
              </div>
            </div>
          </div>

          {/* Pricing Info */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-[#121c2c] border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Tổng tiền thanh toán:</span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                Thanh toán tại quầy
              </span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono">
              {Number(booking.totalPrice).toLocaleString("vi-VN")} đ
            </div>
          </div>

          {/* Closing Note / Agreement with Guest */}
          {booking.closingNote && (
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold uppercase tracking-wider text-[10px]">
                <span>💬</span>
                <span>Câu chốt với khách</span>
              </div>
              <p className="text-amber-100/90 italic leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-amber-500/20">
                &ldquo;{booking.closingNote}&rdquo;
              </p>
            </div>
          )}

          {/* Note if any */}
          {booking.note && (
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs space-y-1">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                Ghi chú của lễ tân
              </span>
              <p className="text-slate-300 leading-relaxed">{booking.note}</p>
            </div>
          )}

          {/* Cancel Section */}
          {booking.status !== "cancelled" && (
            <div className="pt-2 border-t border-slate-800/80">
              {!showConfirmCancel ? (
                <button
                  onClick={() => setShowConfirmCancel(true)}
                  className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-colors"
                >
                  Hủy đặt phòng này
                </button>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/60 space-y-3">
                  <p className="text-xs text-rose-200 font-medium">
                    Bạn có chắc chắn muốn hủy đặt phòng #{booking.id}?
                  </p>
                  <input
                    type="text"
                    placeholder="Lý do hủy (tùy chọn)..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-rose-900 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                  {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      className="flex-1"
                      isLoading={cancelling}
                      onClick={handleCancelBooking}
                    >
                      Xác nhận hủy
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowConfirmCancel(false)}
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0d131f] flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Đóng bảng
          </Button>
        </div>
      </div>
    </div>
  );
};
