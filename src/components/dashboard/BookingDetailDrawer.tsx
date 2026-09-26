"use client";

import React, { useState, useEffect } from "react";
import { GanttBookingItem } from "@/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { BookingEditForm } from "./BookingEditForm";
import { useToast } from "../ui/Toast";

interface BookingDetailDrawerProps {
  booking: GanttBookingItem | null;
  onClose: () => void;
  onBookingCancelled?: () => void;
  onBookingUpdated?: (updatedBooking: GanttBookingItem) => void;
}

export const BookingDetailDrawer: React.FC<BookingDetailDrawerProps> = ({
  booking,
  onClose,
  onBookingCancelled,
  onBookingUpdated,
}) => {
  const toast = useToast();
  const [currentBooking, setCurrentBooking] = useState<GanttBookingItem | null>(booking);
  const [mode, setMode] = useState<"view" | "edit">("view");

  // +1h Checkout state
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState("");
  const [extendSuccess, setExtendSuccess] = useState("");

  // Cancel state
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Synchronize prop updates
  useEffect(() => {
    setCurrentBooking(booking);
    setMode("view");
    setExtendError("");
    setExtendSuccess("");
    setShowConfirmCancel(false);
  }, [booking]);

  if (!currentBooking) return null;

  const checkin = new Date(currentBooking.checkinAt);
  const checkout = new Date(currentBooking.checkoutAt);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleExtend1h = async () => {
    try {
      setExtending(true);
      setExtendError("");
      setExtendSuccess("");

      const res = await fetch(`/api/bookings/${currentBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extend1h" }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        const errorText = data.error || "Không thể gia hạn thêm 1 giờ.";
        if (res.status === 409) {
          toast.warning(errorText, "Xung đột lịch & Giờ dọn");
        } else {
          toast.error(errorText, "Lỗi gia hạn (+1h)");
        }
        throw new Error(errorText);
      }

      const successMsg = "Đã gia hạn thêm 1 giờ trả phòng (+60.000đ)!";
      setExtendSuccess(successMsg);
      toast.success(successMsg, "Gia hạn thành công");

      const updated: GanttBookingItem = {
        ...currentBooking,
        checkoutAt: data.booking.checkout_at,
        totalPrice: data.booking.total_price,
      };
      setCurrentBooking(updated);
      onBookingUpdated?.(updated);
    } catch (err: any) {
      setExtendError(err.message || "Lỗi khi gia hạn thêm 1 giờ.");
    } finally {
      setExtending(false);
    }
  };

  const handleEditSuccess = (updatedData: any) => {
    const updated: GanttBookingItem = {
      ...currentBooking,
      roomId: updatedData.room_id || currentBooking.roomId,
      bookingType: updatedData.booking_type || currentBooking.bookingType,
      checkinAt: updatedData.checkin_at || currentBooking.checkinAt,
      checkoutAt: updatedData.checkout_at || currentBooking.checkoutAt,
      totalPrice: updatedData.total_price ?? currentBooking.totalPrice,
      note: updatedData.note !== undefined ? updatedData.note : currentBooking.note,
      closingNote: updatedData.closing_note !== undefined ? updatedData.closing_note : currentBooking.closingNote,
    };
    setCurrentBooking(updated);
    setMode("view");
    toast.success(`Đã cập nhật đơn đặt phòng #${currentBooking.id} thành công!`, "Lưu thành công");
    onBookingUpdated?.(updated);
  };

  const handleCancelBooking = async () => {
    try {
      setCancelling(true);
      setErrorMsg("");
      const res = await fetch(`/api/bookings/${currentBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", cancelReason }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        const errorText = data.error || "Không thể hủy đặt phòng.";
        toast.error(errorText, "Lỗi hủy đặt phòng");
        throw new Error(errorText);
      }

      toast.success(`Đơn #${currentBooking.id} đã được hủy thành công.`, "Đã hủy đặt phòng");
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
                #{currentBooking.id}
              </span>
              <Badge status={currentBooking.status} size="sm" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mt-1">
              {mode === "edit" ? "Chỉnh sửa Đặt Phòng" : "Chi tiết Đặt Phòng"}
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
          {mode === "edit" ? (
            <BookingEditForm
              bookingId={currentBooking.id}
              onSuccess={handleEditSuccess}
              onCancel={() => setMode("view")}
            />
          ) : (
            <>
              {/* Primary Action Buttons (+1h & Edit) */}
              {currentBooking.status !== "cancelled" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={extending}
                      onClick={handleExtend1h}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 border border-emerald-400/50 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      title="Gia hạn checkout thêm đúng 1 giờ (+60.000đ)"
                    >
                      {extending ? (
                        <span>Đang thêm 1h...</span>
                      ) : (
                        <>
                          <span>⏱️ +1h Checkout</span>
                          <span className="text-[10px] opacity-80">(+60k)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span>✏️ Chỉnh sửa</span>
                    </button>
                  </div>

                  {extendError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-[11px] text-rose-200 flex items-start gap-1.5 animate-in fade-in duration-150">
                      <span className="shrink-0 text-sm">⚠️</span>
                      <span className="leading-snug">{extendError}</span>
                    </div>
                  )}

                  {extendSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-[11px] text-emerald-200 flex items-center gap-1.5 animate-in fade-in duration-150">
                      <span className="shrink-0 text-sm">✅</span>
                      <span>{extendSuccess}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Guest Information Card */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Khách hàng
                </span>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-bold text-slate-100">{currentBooking.guestName}</p>
                    <p className="text-sm font-mono text-emerald-400 mt-0.5">{currentBooking.phone}</p>
                  </div>
                  <a
                    href={`tel:${currentBooking.phone}`}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>📞</span>
                    <span>Gọi</span>
                  </a>
                </div>

                {/* Social handles */}
                {(currentBooking.instagram || currentBooking.facebook) && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 text-xs">
                    {currentBooking.instagram && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 font-medium">
                        <span className="text-xs">📸</span>
                        <span>@{currentBooking.instagram}</span>
                      </div>
                    )}
                    {currentBooking.facebook && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium">
                        <span className="text-xs font-bold text-blue-400">f</span>
                        <span>{currentBooking.facebook}</span>
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
                    <Badge type={currentBooking.bookingType} size="sm" />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <span className="text-xs text-slate-400 block mb-1">Phòng</span>
                    <span className="font-semibold text-slate-200">Phòng {currentBooking.roomId}</span>
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
                  {Number(currentBooking.totalPrice).toLocaleString("vi-VN")} đ
                </div>
              </div>

              {/* Closing Note / Agreement with Guest */}
              {currentBooking.closingNote && (
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold uppercase tracking-wider text-[10px]">
                    <span>💬</span>
                    <span>Câu chốt với khách</span>
                  </div>
                  <p className="text-amber-100/90 italic leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-amber-500/20">
                    &ldquo;{currentBooking.closingNote}&rdquo;
                  </p>
                </div>
              )}

              {/* Note if any */}
              {currentBooking.note && (
                <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs space-y-1">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                    Ghi chú của lễ tân
                  </span>
                  <p className="text-slate-300 leading-relaxed">{currentBooking.note}</p>
                </div>
              )}

              {/* Cancel Confirmation Prompt */}
              {showConfirmCancel && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 space-y-3 animate-in fade-in duration-200">
                  <p className="text-xs text-rose-200 font-medium">
                    Bạn có chắc chắn muốn hủy đặt phòng #{currentBooking.id}?
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
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0d131f] flex items-center justify-between">
          <div>
            {mode === "view" && currentBooking.status !== "cancelled" && !showConfirmCancel && (
              <button
                type="button"
                onClick={() => setShowConfirmCancel(true)}
                className="text-[11px] text-rose-400/80 hover:text-rose-300 underline underline-offset-2 transition-colors cursor-pointer"
              >
                Hủy đặt phòng này
              </button>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Đóng bảng
          </Button>
        </div>
      </div>
    </div>
  );
};
