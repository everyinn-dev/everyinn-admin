"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { GanttBookingItem } from "@/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { BookingEditForm } from "./BookingEditForm";
import { useToast } from "../ui/Toast";
import { apiFetch } from "@/lib/apiClient";
import { notifyDataChanged } from "@/lib/syncEvents";

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

  // No-Show state
  const [showConfirmNoShow, setShowConfirmNoShow] = useState(false);
  const [noShowing, setNoShowing] = useState(false);
  const [noShowReason, setNoShowReason] = useState("Khách báo hủy sát giờ vi phạm quy định");
  const [hasRefund, setHasRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [noShowError, setNoShowError] = useState("");

  // Complete Deposit Payment state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState("");
  const [completingPayment, setCompletingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Reminder state
  const [markingReminder, setMarkingReminder] = useState(false);

  // Synchronize prop updates
  useEffect(() => {
    setCurrentBooking(booking);
    setMode("view");
    setExtendError("");
    setExtendSuccess("");
    setShowConfirmCancel(false);
    setShowConfirmNoShow(false);
    setHasRefund(false);
    setRefundAmount(0);
    setNoShowError("");
    setShowPaymentForm(false);
    setPaymentError("");
    setPaymentNote("");
    if (booking) {
      const remaining = booking.remainingAmount !== undefined
        ? booking.remainingAmount
        : Math.max(0, booking.totalPrice - (booking.paidAmount || booking.depositAmount || 0));
      setPaymentAmount(remaining);
    }
  }, [booking]);

  if (!currentBooking) return null;

  const checkin = new Date(currentBooking.checkinAt);
  const checkout = new Date(currentBooking.checkoutAt);
  const isPastCheckout = new Date() > checkout;

  const actualCashReceived =
    currentBooking.isDeposit === 1 || (currentBooking as any).is_deposit === 1
      ? (currentBooking.paidAmount ?? (currentBooking as any).paid_amount ?? currentBooking.depositAmount ?? (currentBooking as any).deposit_amount ?? 0)
      : (currentBooking.totalPrice || 0);

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

      const res = await apiFetch(`/api/bookings/${currentBooking.id}`, {
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
        modNo: data.booking.mod_no !== undefined ? data.booking.mod_no : (currentBooking.modNo || 0) + 1,
        updatedAt: data.booking.updated_at || new Date().toISOString(),
        updatedByStaffName: data.booking.updated_by_staff_name || currentBooking.updatedByStaffName,
      };
      setCurrentBooking(updated);
      onBookingUpdated?.(updated);
      notifyDataChanged("BOOKINGS_CHANGED");
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
      modNo: updatedData.mod_no !== undefined ? updatedData.mod_no : (currentBooking.modNo || 0) + 1,
      updatedAt: updatedData.updated_at || new Date().toISOString(),
      updatedByStaffName: updatedData.updated_by_staff_name || currentBooking.updatedByStaffName,
    };
    setCurrentBooking(updated);
    setMode("view");
    toast.success(`Đã cập nhật đơn đặt phòng #${currentBooking.id} thành công!`, "Lưu thành công");
    onBookingUpdated?.(updated);
    notifyDataChanged("BOOKINGS_CHANGED");
  };

  const handleCancelBooking = async () => {
    try {
      setCancelling(true);
      setErrorMsg("");
      const res = await apiFetch(`/api/bookings/${currentBooking.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelReason }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        const errorText = data.error || "Không thể xóa đặt phòng.";
        toast.error(errorText, "Lỗi xóa đặt phòng");
        throw new Error(errorText);
      }

      toast.success(
        data.message || `Đơn #${currentBooking.id} đã được xóa thành công. Lịch phòng và hồ sơ CDP đã được cập nhật.`,
        "Đã xóa đặt phòng"
      );
      setShowConfirmCancel(false);
      onBookingCancelled?.();
      notifyDataChanged("BOOKINGS_CHANGED");
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi xóa đặt phòng.");
    } finally {
      setCancelling(false);
    }
  };

  const handleNoShowBooking = async () => {
    try {
      setNoShowing(true);
      setNoShowError("");
      const actualRefund = hasRefund ? Math.min(actualCashReceived, Math.max(0, refundAmount)) : 0;

      const res = await apiFetch(`/api/bookings/${currentBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "no_show",
          noShowReason,
          refundAmount: actualRefund,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        const errorText = data.error || "Không thể đánh dấu No-Show.";
        toast.error(errorText, "Lỗi No-Show");
        throw new Error(errorText);
      }

      toast.success(
        data.message || `Đơn #${currentBooking.id} đã đánh dấu No-Show thành công.`,
        "No-Show thành công"
      );
      setShowConfirmNoShow(false);

      const netRetained = data.netRetained ?? (actualCashReceived - actualRefund);
      const updated: GanttBookingItem = {
        ...currentBooking,
        status: "no_show",
        totalPrice: netRetained,
        refundAmount: actualRefund,
        originalPrice: currentBooking.totalPrice,
        noShowReason,
        noShowAt: new Date().toISOString(),
      };
      setCurrentBooking(updated);
      onBookingUpdated?.(updated);
      onBookingCancelled?.();
      notifyDataChanged("BOOKINGS_CHANGED");
    } catch (err: any) {
      setNoShowError(err.message || "Lỗi khi đánh dấu No-Show.");
    } finally {
      setNoShowing(false);
    }
  };

  const handleCompletePayment = async () => {
    try {
      setCompletingPayment(true);
      setPaymentError("");
      const res = await apiFetch(`/api/bookings/${currentBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_deposit_payment",
          paymentAmount,
          note: paymentNote,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể bổ sung thanh toán.");
      }

      toast.success(data.message || "Đã bổ sung thanh toán thành công!", "Thanh toán thành công");
      const updated: GanttBookingItem = {
        ...currentBooking,
        paidAmount: data.paidAmount,
        remainingAmount: data.remainingAmount,
        depositStatus: data.depositStatus,
        remainingPaidAt: new Date().toISOString(),
      };
      setCurrentBooking(updated);
      setShowPaymentForm(false);
      onBookingUpdated?.(updated);
      notifyDataChanged("BOOKINGS_CHANGED");
    } catch (err: any) {
      setPaymentError(err.message || "Lỗi khi bổ sung thanh toán.");
    } finally {
      setCompletingPayment(false);
    }
  };

  const handleMarkReminderSent = async () => {
    try {
      setMarkingReminder(true);
      const res = await apiFetch(`/api/bookings/${currentBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_deposit_reminder_sent" }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể ghi nhận gửi nhắc cọc.");
      }
      toast.success("Đã ghi nhận gửi nhắc cọc cho khách!", "Gửi nhắc thành công");
      const updated: GanttBookingItem = {
        ...currentBooking,
        depositReminderSentAt: data.depositReminderSentAt,
      };
      setCurrentBooking(updated);
      onBookingUpdated?.(updated);
      notifyDataChanged("BOOKINGS_CHANGED");
    } catch (err: any) {
      toast.error(err.message || "Lỗi ghi nhận gửi nhắc cọc.", "Lỗi");
    } finally {
      setMarkingReminder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div
        className="w-full max-w-md bg-white border-l border-slate-200 shadow-2xl h-full flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                #{currentBooking.id}
              </span>
              <Badge status={currentBooking.status} size="sm" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              {mode === "edit" ? "Chỉnh sửa Đặt Phòng" : "Chi tiết Đặt Phòng"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors font-bold cursor-pointer"
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
              {/* No Show Alert Banner if status is no_show */}
              {currentBooking.status === "no_show" && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 shadow-xs space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🚫</span>
                      <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                        Khách Không Đến / Hủy Vi Phạm
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                      Đã giải phóng phòng
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 space-y-1.5 bg-white p-3 rounded-xl border border-purple-200 shadow-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Thời điểm No-Show:</span>
                      <span className="font-mono text-purple-900 font-bold">
                        {currentBooking.noShowAt ? formatDateTime(new Date(currentBooking.noShowAt)) : "Đã ghi nhận"}
                      </span>
                    </div>
                    {currentBooking.noShowByStaffName && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Nhân viên xử lý:</span>
                        <span className="text-slate-900 font-semibold">{currentBooking.noShowByStaffName}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-start gap-2 pt-1 border-t border-slate-100">
                      <span className="text-slate-500 shrink-0">Lý do ghi nhận:</span>
                      <span className="text-slate-800 italic text-right font-medium">
                        {currentBooking.noShowReason || "Khách không đến / Hủy vi phạm quy định"}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px] font-medium">Đã hoàn lại:</span>
                        <span className="font-mono text-purple-800 font-bold">
                          {currentBooking.refundAmount ? Number(currentBooking.refundAmount).toLocaleString("vi-VN") : "0"} đ
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[11px] font-medium">Thực thu giữ:</span>
                        <span className="font-mono text-emerald-700 font-extrabold">
                          {Number(currentBooking.totalPrice).toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rebook CTA */}
                  <Link
                    href={`/bookings/new?phone=${encodeURIComponent(currentBooking.phone)}&name=${encodeURIComponent(currentBooking.guestName)}`}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <span>🔄</span>
                    <span>Tạo Đơn Đặt Phòng Mới Cho Khách Này (Rebook)</span>
                  </Link>
                </div>
              )}

              {/* Primary Action Buttons (+1h & Edit) */}
              {currentBooking.status !== "cancelled" && currentBooking.status !== "no_show" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={extending}
                      onClick={handleExtend1h}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-sm border border-emerald-500 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      title="Gia hạn checkout thêm đúng 1 giờ (+60.000đ)"
                    >
                      {extending ? (
                        <span>Đang thêm 1h...</span>
                      ) : (
                        <>
                          <span>⏱️ +1h Checkout</span>
                          <span className="text-[10px] opacity-90">(+60k)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span>✏️ Chỉnh sửa</span>
                    </button>
                  </div>

                  {extendError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-[11px] text-rose-800 flex items-start gap-1.5 animate-in fade-in duration-150 font-medium">
                      <span className="shrink-0 text-sm">⚠️</span>
                      <span className="leading-snug">{extendError}</span>
                    </div>
                  )}

                  {extendSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-[11px] text-emerald-800 flex items-center gap-1.5 animate-in fade-in duration-150 font-bold">
                      <span className="shrink-0 text-sm">✅</span>
                      <span>{extendSuccess}</span>
                    </div>
                  )}

                  {/* Complete Deposit Payment CTA & Form */}
                  {currentBooking.isDeposit === 1 && currentBooking.depositStatus === "deposit_paid" && (
                    <div className="pt-1 space-y-2.5">
                      {!showPaymentForm ? (
                        <button
                          type="button"
                          onClick={() => {
                            const remaining =
                              currentBooking.remainingAmount !== undefined
                                ? currentBooking.remainingAmount
                                : Math.max(0, currentBooking.totalPrice - (currentBooking.paidAmount || currentBooking.depositAmount || 0));
                            setPaymentAmount(remaining);
                            setShowPaymentForm(true);
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold text-xs shadow-sm border border-amber-500 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                        >
                          <span>💰</span>
                          <span>Bổ Sung Thanh Toán Phần Còn Lại</span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-800/40 font-mono text-[11px]">
                            ({(currentBooking.remainingAmount ?? (currentBooking.totalPrice - (currentBooking.paidAmount || 0))).toLocaleString("vi-VN")} đ)
                          </span>
                        </button>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 space-y-3 shadow-xs animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                              <span>💰</span> Bổ sung thanh toán cọc
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowPaymentForm(false)}
                              className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                            >
                              ✕ Đóng
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Số tiền thu thêm (VNĐ):
                              </label>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={paymentAmount || ""}
                                onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                                className="w-full rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                                placeholder="Nhập số tiền thu thêm..."
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Ghi chú thanh toán (Tùy chọn):
                              </label>
                              <input
                                type="text"
                                value={paymentNote}
                                onChange={(e) => setPaymentNote(e.target.value)}
                                className="w-full rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                                placeholder="VD: Khách chuyển khoản VCB, trả tiền mặt tại quầy..."
                              />
                            </div>
                          </div>

                          {paymentError && (
                            <p className="text-[11px] text-rose-700 font-medium">⚠️ {paymentError}</p>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowPaymentForm(false)}
                              className="flex-1 py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              disabled={completingPayment}
                              onClick={handleCompletePayment}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              {completingPayment ? "Đang lưu..." : "Xác Nhận Đã Thu"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Guest Information Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 shadow-xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Khách hàng
                </span>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-bold text-slate-900">{currentBooking.guestName}</p>
                    <p className="text-sm font-mono font-bold text-emerald-700 mt-0.5">{currentBooking.phone}</p>
                  </div>
                  <a
                    href={`tel:${currentBooking.phone}`}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span>📞</span>
                    <span>Gọi</span>
                  </a>
                </div>

                {/* Social handles */}
                {(currentBooking.instagram || currentBooking.facebook) && (
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2 text-xs">
                    {currentBooking.instagram && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 border border-pink-200 text-pink-700 font-bold shadow-xs">
                        <span className="text-xs">📸</span>
                        <span>@{currentBooking.instagram}</span>
                      </div>
                    )}
                    {currentBooking.facebook && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-bold shadow-xs">
                        <span className="text-xs font-bold text-blue-600">f</span>
                        <span>{currentBooking.facebook}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Booking Details */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Lịch đặt & Phòng
                </span>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-xs">
                    <span className="text-xs text-slate-500 block mb-1 font-medium">Loại hình</span>
                    <Badge type={currentBooking.bookingType} size="sm" />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-xs">
                    <span className="text-xs text-slate-500 block mb-1 font-medium">Phòng</span>
                    <span className="font-bold text-slate-800">Phòng {currentBooking.roomId}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Nhận phòng (Check-in):</span>
                    <span className="font-bold text-slate-800">{formatDateTime(checkin)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Trả phòng (Check-out):</span>
                    <span className="font-bold text-slate-800">{formatDateTime(checkout)}</span>
                  </div>
                </div>
              </div>

              {/* Pricing Info */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/80 via-slate-50 to-white border border-emerald-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Tổng giá trị đơn phòng:</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                    currentBooking.isDeposit === 1
                      ? currentBooking.depositStatus === "fully_paid"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-900 border border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}>
                    {currentBooking.isDeposit === 1
                      ? currentBooking.depositStatus === "fully_paid"
                        ? "Đã thu đủ 100%"
                        : "Đơn đặt cọc (Chờ thu nốt)"
                      : "Thanh toán tại quầy"}
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-700 font-mono tracking-tight">
                  {Number(currentBooking.totalPrice).toLocaleString("vi-VN")} đ
                </div>

                {/* Deposit Details Breakdown */}
                {currentBooking.isDeposit === 1 && (
                  <div className="pt-2.5 border-t border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-slate-500">Đã thanh toán (Cọc):</span>
                      <span className="font-mono font-bold text-emerald-800">
                        {(currentBooking.paidAmount || currentBooking.depositAmount || 0).toLocaleString("vi-VN")} đ
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-slate-500">Số tiền còn thiếu:</span>
                      <span className={`font-mono font-bold ${
                        (currentBooking.remainingAmount || 0) > 0 ? "text-amber-900 font-extrabold" : "text-emerald-700"
                      }`}>
                        {(currentBooking.remainingAmount ?? (currentBooking.totalPrice - (currentBooking.paidAmount || 0))).toLocaleString("vi-VN")} đ
                      </span>
                    </div>

                    {currentBooking.depositDueDate && (
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="text-slate-500">Hạn nộp phần còn lại:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {new Date(currentBooking.depositDueDate).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}

                    {/* Reminder Status & Quick Action */}
                    <div className="pt-1.5 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px]">
                      {currentBooking.depositReminderSentAt ? (
                        <span className="text-emerald-800 font-medium flex items-center gap-1">
                          <span>✅</span> Đã gửi nhắc cọc ({new Date(currentBooking.depositReminderSentAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })})
                        </span>
                      ) : currentBooking.depositStatus === "deposit_paid" ? (
                        <button
                          type="button"
                          disabled={markingReminder}
                          onClick={handleMarkReminderSent}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        >
                          <span>💬</span>
                          <span>{markingReminder ? "Đang lưu..." : "Đánh dấu đã gửi nhắc cọc"}</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              {/* Closing Note / Agreement with Guest */}
              {currentBooking.closingNote && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs space-y-1.5 shadow-xs">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold uppercase tracking-wider text-[10px]">
                    <span>💬</span>
                    <span>Câu chốt với khách</span>
                  </div>
                  <p className="text-amber-950 font-medium italic leading-relaxed bg-white p-2.5 rounded-lg border border-amber-200 shadow-xs">
                    &ldquo;{currentBooking.closingNote}&rdquo;
                  </p>
                </div>
              )}

              {/* Note if any */}
              {currentBooking.note && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 shadow-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Ghi chú của lễ tân
                  </span>
                  <p className="text-slate-700 leading-relaxed font-medium">{currentBooking.note}</p>
                </div>
              )}

              {/* Control Fields (Audit & Modification Tracking) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>Thông tin kiểm soát (Control Fields)</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      (currentBooking.modNo || 0) > 0
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-slate-200 text-slate-700 border border-slate-300"
                    }`}
                  >
                    {(currentBooking.modNo || 0) > 0
                      ? `mod_no: ${currentBooking.modNo} (Đã sửa)`
                      : "mod_no: 0 (Bản gốc)"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1 shadow-xs">
                    <span className="text-[10px] text-slate-500 block font-medium">Người & Ngày tạo:</span>
                    <div className="font-bold text-slate-800">
                      {currentBooking.createdByStaffName || "Hệ thống"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {currentBooking.createdAt ? formatDateTime(new Date(currentBooking.createdAt)) : "-"}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1 shadow-xs">
                    <span className="text-[10px] text-slate-500 block font-medium">Chỉnh sửa cuối:</span>
                    <div className="font-bold text-slate-800">
                      {(currentBooking.modNo || 0) > 0
                        ? currentBooking.updatedByStaffName || "Nhân viên"
                        : "Chưa chỉnh sửa"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {(currentBooking.modNo || 0) > 0 && currentBooking.updatedAt
                        ? formatDateTime(new Date(currentBooking.updatedAt))
                        : "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cancel Confirmation Prompt */}
              {showConfirmCancel && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-3.5 animate-in fade-in duration-200 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">🗑️</span>
                    <div>
                      <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                        Xác nhận xóa hoàn toàn đặt phòng #{currentBooking.id}?
                      </h4>
                      <p className="text-[11px] text-rose-800 mt-1 leading-relaxed font-medium">
                        Hệ thống sẽ <strong>xóa vĩnh viễn (Hard delete)</strong> đơn này, giải phóng lịch trên biểu đồ Gantt và tự động hoàn trả số lượt/tiền chi tiêu khỏi hồ sơ CDP của khách (vẫn lưu thông tin thành viên).
                      </p>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Lý do xóa / hủy đơn (tùy chọn)..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 shadow-xs"
                  />
                  {errorMsg && <p className="text-xs text-rose-700 font-semibold">{errorMsg}</p>}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="danger"
                      className="flex-1 font-semibold"
                      isLoading={cancelling}
                      onClick={handleCancelBooking}
                    >
                      Xác nhận xóa vĩnh viễn
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

              {/* No-Show Confirmation Prompt */}
              {showConfirmNoShow && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-300 space-y-3.5 animate-in fade-in duration-200 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚫</span>
                    <div>
                      <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wide">
                        Xác nhận No-Show (Khách không đến / Hủy vi phạm)
                      </h4>
                      <p className="text-[11px] text-purple-800 font-medium">
                        Phòng sẽ được giải phóng ngay lập tức trên Gantt để nhận khách khác.
                      </p>
                    </div>
                  </div>

                  {/* Refund Choice */}
                  <div className="space-y-2 bg-white p-3 rounded-lg border border-purple-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Chính sách hoàn tiền:
                    </span>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="refundChoice"
                          checked={!hasRefund}
                          onChange={() => {
                            setHasRefund(false);
                            setRefundAmount(0);
                          }}
                          className="accent-purple-600 cursor-pointer"
                        />
                        <span>Không hoàn tiền (Thu giữ 100%: <strong>{actualCashReceived.toLocaleString("vi-VN")}đ</strong>)</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="refundChoice"
                          checked={hasRefund}
                          onChange={() => {
                            setHasRefund(true);
                            setRefundAmount(Math.round(actualCashReceived * 0.5));
                          }}
                          className="accent-purple-600 cursor-pointer"
                        />
                        <span>Có hoàn tiền một phần cho khách</span>
                      </label>
                    </div>

                    {hasRefund && (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-slate-500 text-[11px] font-medium">Gợi ý nhanh:</span>
                          <button
                            type="button"
                            onClick={() => setRefundAmount(Math.round(actualCashReceived * 0.3))}
                            className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-purple-800 font-bold border border-slate-200 cursor-pointer shadow-xs"
                          >
                            Hoàn 30%
                          </button>
                          <button
                            type="button"
                            onClick={() => setRefundAmount(Math.round(actualCashReceived * 0.5))}
                            className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-purple-800 font-bold border border-slate-200 cursor-pointer shadow-xs"
                          >
                            Hoàn 50%
                          </button>
                          <button
                            type="button"
                            onClick={() => setRefundAmount(actualCashReceived)}
                            className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-purple-800 font-bold border border-slate-200 cursor-pointer shadow-xs"
                          >
                            Hoàn 100%
                          </button>
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-600 block mb-1 font-medium">
                            Số tiền hoàn trả (VNĐ, tối đa {actualCashReceived.toLocaleString("vi-VN")}đ):
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={actualCashReceived}
                            step="any"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(Math.min(actualCashReceived, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-purple-300 text-xs font-mono font-bold text-amber-700 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 shadow-xs"
                          />
                        </div>

                        <div className="p-2 rounded bg-slate-50 text-[11px] space-y-0.5 border border-slate-200">
                          <div className="flex justify-between text-slate-500">
                            <span>Khách đã đóng thực tế:</span>
                            <span className="font-mono font-bold">{actualCashReceived.toLocaleString("vi-VN")}đ</span>
                          </div>
                          <div className="flex justify-between text-rose-700 font-medium">
                            <span>Số tiền hoàn trả:</span>
                            <span className="font-mono font-bold">-{refundAmount.toLocaleString("vi-VN")}đ</span>
                          </div>
                          <div className="flex justify-between text-emerald-800 font-bold pt-1 border-t border-slate-200">
                            <span>Doanh thu giữ lại thực tế:</span>
                            <span className="font-mono">{Math.max(0, actualCashReceived - refundAmount).toLocaleString("vi-VN")}đ</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reason input */}
                  <div>
                    <label className="text-[11px] text-slate-700 block mb-1 font-bold">
                      Lý do No-Show / Hủy vi phạm:
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Khách báo bận không đến được, Khách tắt máy..."
                      value={noShowReason}
                      onChange={(e) => setNoShowReason(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-purple-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 shadow-xs"
                    />
                  </div>

                  {noShowError && <p className="text-xs text-rose-700 font-semibold">{noShowError}</p>}

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                      isLoading={noShowing}
                      onClick={handleNoShowBooking}
                    >
                      Xác nhận No-Show
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowConfirmNoShow(false)}
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
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {mode === "view" && currentBooking.status === "confirmed" && !isPastCheckout && !showConfirmNoShow && !showConfirmCancel && (
              <button
                type="button"
                onClick={() => {
                  setShowConfirmNoShow(true);
                  setShowConfirmCancel(false);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>🚫</span>
                <span>Khách không đến (No-Show)</span>
              </button>
            )}

            {mode === "view" && !showConfirmCancel && !showConfirmNoShow && (
              <button
                type="button"
                onClick={() => {
                  setShowConfirmCancel(true);
                  setShowConfirmNoShow(false);
                }}
                className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
              >
                Xóa / Hủy đặt phòng này
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
