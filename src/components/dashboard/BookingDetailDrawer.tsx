"use client";

import { DoorCodeCard } from "@/components/agent/DoorCodeCard";
import React, { useState, useEffect } from "react";
import { GanttBookingItem } from "@/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { BookingEditForm } from "./BookingEditForm";
import { useToast } from "../ui/Toast";
import { apiFetch } from "@/lib/apiClient";
import { notifyDataChanged } from "@/lib/syncEvents";
import { CancelBookingPanel } from "@/components/bookings/cancel/CancelBookingPanel";
import { ClosedBookingBanner } from "@/components/bookings/cancel/ClosedBookingBanner";
import { bookingRowToItem, canCloseBooking, isClosedBooking, isVersionConflict, netReceivedOf, type BffError } from "@/lib/bookingClosure";
import type { Booking } from "@/types";

/** Overlay a fresh row on the current item without wiping fields the row does not carry. */
function mergeFresh(current: GanttBookingItem, row: Booking): GanttBookingItem {
  const fresh = bookingRowToItem(row) as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(fresh)) if (v !== undefined) merged[k] = v;
  return merged as unknown as GanttBookingItem;
}

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

  // Cancel state (one flow: cancel with a reason; "No-show" is one of the reasons)
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  // Complete Deposit Payment state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState("");
  const [completingPayment, setCompletingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Reminder state
  const [markingReminder, setMarkingReminder] = useState(false);

  // Loyalty sync retry state (A-W8)
  const [retryingSync, setRetryingSync] = useState(false);

  // Synchronize prop updates
  useEffect(() => {
    if (!booking) {
      setCurrentBooking(null);
      return;
    }
    // Don't overwrite if currentBooking is already newer for the same booking ID
    if (
      currentBooking &&
      currentBooking.id === booking.id &&
      (currentBooking.version || currentBooking.modNo || 0) > (booking.version || booking.modNo || 0)
    ) {
      return;
    }
    const isNewBooking = !currentBooking || currentBooking.id !== booking.id;
    setCurrentBooking(booking);
    if (isNewBooking) {
      setMode("view");
      setExtendError("");
      setExtendSuccess("");
      setShowConfirmCancel(false);
      setShowPaymentForm(false);
      setPaymentError("");
      setPaymentNote("");
    }
    const remaining = booking.remainingAmount !== undefined
      ? booking.remainingAmount
      : Math.max(0, booking.totalPrice - (booking.paidAmount || booking.depositAmount || 0));
    setPaymentAmount(remaining);
  }, [booking, currentBooking]);

  // The list / Gantt snapshot may be stale (cancelled in another tab or by a colleague): always load the
  // latest state when a booking is opened, so every action below is gated on the real status.
  const openedId = booking?.id;
  useEffect(() => {
    if (!openedId) return;
    let alive = true;
    apiFetch(`/api/bookings/${openedId}`)
      .then(async (res) => (res.ok ? ((await res.json()) as { booking?: Booking }) : null))
      .then((data) => {
        if (!alive || !data?.booking) return;
        setCurrentBooking((cur) => (cur && cur.id === openedId ? mergeFresh(cur, data.booking!) : cur));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [openedId]);

  if (!currentBooking) return null;

  const checkin = new Date(currentBooking.checkinAt);
  const checkout = new Date(currentBooking.checkoutAt);
  const isPastCheckout = new Date() > checkout;

  // Money actually received (ledger: received − refunded) — never assumed from totalPrice.
  const actualCashReceived = netReceivedOf(currentBooking);
  const isClosed = isClosedBooking(currentBooking);
  const canClose = canCloseBooking(currentBooking);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const refetchBooking = async () => {
    if (!currentBooking) return;
    try {
      const res = await apiFetch(`/api/bookings/${currentBooking.id}`);
      if (res.ok) {
        const data = ((await res.json()) as any);
        if (data.booking) {
          const fresh = mergeFresh(currentBooking, data.booking as Booking);
          setCurrentBooking(fresh);
          onBookingUpdated?.(fresh);
        }
      }
      notifyDataChanged("BOOKINGS_CHANGED");
    } catch (err) {
      console.error("Failed to refetch booking:", err);
    }
  };

  /**
   * Core rejected a command. Only VERSION_CONFLICT means "someone else changed it" → reload. Every other code
   * (INVALID_STATE, PAST_CHECKOUT, REFUND_EXCEEDS_RECEIVED, …) carries Core's own Vietnamese reason → show it,
   * and still reload so the buttons reflect the real status.
   * Returns true when the caller should stop silently.
   */
  const handleCommandError = async (status: number, data: BffError, title: string): Promise<boolean> => {
    if (isVersionConflict(status, data)) {
      toast.warning("Dữ liệu đặt phòng đã thay đổi bởi người khác. Đã tải lại dữ liệu mới nhất.", "Xung đột dữ liệu");
      await refetchBooking();
      return true;
    }
    toast.error(data.error || "Thao tác không thành công.", title);
    if (status === 409) await refetchBooking();
    return false;
  };

  const handleRetryLoyaltySync = async () => {
    if (!currentBooking) return;
    try {
      setRetryingSync(true);
      const res = await apiFetch(`/api/bookings/${currentBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_loyalty_sync" }),
      });
      const data = ((await res.json()) as any);
      if (!res.ok) {
        throw new Error(data.error || "Không thể kích hoạt đồng bộ điểm thành viên.");
      }
      toast.success("Đã đồng bộ điểm thành viên thành công!", "Tích lũy thành viên");
      const updated: GanttBookingItem = {
        ...currentBooking,
        loyaltySyncStatus: "synced",
      };
      setCurrentBooking(updated);
      onBookingUpdated?.(updated);
      notifyDataChanged("BOOKINGS_CHANGED");
    } catch (err: any) {
      toast.error(err.message || "Lỗi đồng bộ điểm thành viên.", "Lỗi");
    } finally {
      setRetryingSync(false);
    }
  };

  const handleExtend1h = async () => {
    try {
      setExtending(true);
      setExtendError("");
      setExtendSuccess("");

      const res = await apiFetch(`/api/bookings/${currentBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extend1h",
          expectedVersion: currentBooking.version ?? currentBooking.modNo,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        const errorText = data.error || "Không thể gia hạn thêm 1 giờ.";
        if (await handleCommandError(res.status, data, "Lỗi gia hạn (+1h)")) return;
        throw new Error(errorText);
      }

      const addedFee = (data.booking?.total_price ?? currentBooking.totalPrice) - currentBooking.totalPrice;
      const successMsg = `Đã gia hạn thêm 1 giờ trả phòng${addedFee > 0 ? ` (+${addedFee.toLocaleString("vi-VN")}đ)` : ""}!`;
      setExtendSuccess(successMsg);
      toast.success(successMsg, "Gia hạn thành công");

      const updated: GanttBookingItem = {
        ...currentBooking,
        checkoutAt: data.booking.checkout_at || currentBooking.checkoutAt,
        totalPrice: data.booking.total_price ?? currentBooking.totalPrice,
        basePrice: data.booking.base_price ?? currentBooking.basePrice,
        extraFee: data.booking.extra_fee ?? currentBooking.extraFee,
        lateCheckoutHours: data.booking.late_checkout_hours ?? currentBooking.lateCheckoutHours,
        remainingAmount: data.booking.remaining_amount ?? currentBooking.remainingAmount,
        paidAmount: data.booking.paid_amount ?? currentBooking.paidAmount,
        depositStatus: data.booking.deposit_status ?? currentBooking.depositStatus,
        discountAmount: data.booking.discount_amount ?? currentBooking.discountAmount,
        promotionName: data.booking.promotion_name !== undefined ? data.booking.promotion_name : currentBooking.promotionName,
        incidentalFee: data.booking.incidental_fee ?? (data.booking as any).incidentalFee ?? currentBooking.incidentalFee,
        incidentalReason: data.booking.incidental_reason ?? (data.booking as any).incidentalReason ?? currentBooking.incidentalReason,
        modNo: data.booking.mod_no !== undefined ? data.booking.mod_no : (currentBooking.modNo || 0) + 1,
        version: data.booking.version ?? data.booking.mod_no ?? (currentBooking.version || 0) + 1,
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
      basePrice: updatedData.base_price ?? currentBooking.basePrice,
      discountAmount: updatedData.discount_amount ?? currentBooking.discountAmount,
      promotionName: updatedData.promotion_name !== undefined ? updatedData.promotion_name : currentBooking.promotionName,
      holidaySurcharge: updatedData.holiday_surcharge ?? currentBooking.holidaySurcharge,
      extraGuestFee: updatedData.extra_guest_fee ?? currentBooking.extraGuestFee,
      extraFee: updatedData.extra_fee ?? currentBooking.extraFee,
      incidentalFee: updatedData.incidental_fee ?? (updatedData as any).incidentalFee ?? currentBooking.incidentalFee,
      incidentalReason: updatedData.incidental_reason ?? (updatedData as any).incidentalReason ?? currentBooking.incidentalReason,
      remainingAmount: updatedData.remaining_amount ?? currentBooking.remainingAmount,
      depositStatus: updatedData.deposit_status ?? currentBooking.depositStatus,
      paidAmount: updatedData.paid_amount ?? currentBooking.paidAmount,
      note: updatedData.note !== undefined ? updatedData.note : currentBooking.note,
      closingNote: updatedData.closing_note !== undefined ? updatedData.closing_note : currentBooking.closingNote,
      modNo: updatedData.mod_no !== undefined ? updatedData.mod_no : (currentBooking.modNo || 0) + 1,
      version: updatedData.version ?? updatedData.mod_no ?? currentBooking.version,
      updatedAt: updatedData.updated_at || new Date().toISOString(),
      updatedByStaffName: updatedData.updated_by_staff_name || currentBooking.updatedByStaffName,
    };
    setCurrentBooking(updated);
    setMode("view");
    toast.success(`Đã cập nhật đơn đặt phòng #${currentBooking.id} thành công!`, "Lưu thành công");
    onBookingUpdated?.(updated);
    notifyDataChanged("BOOKINGS_CHANGED");
  };

  /** The cancel panel succeeded: show the closed state in place (read-only) instead of closing the drawer. */
  const handleBookingClosed = ({ booking: row, message }: { booking: Record<string, unknown>; message: string }) => {
    toast.success(message, "Đã huỷ đặt phòng");
    const updated = mergeFresh(currentBooking, row as unknown as Booking);
    setCurrentBooking(updated);
    setShowConfirmCancel(false);
    setMode("view");
    onBookingUpdated?.(updated);
    onBookingCancelled?.();
    notifyDataChanged("BOOKINGS_CHANGED");
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
          expectedVersion: currentBooking.version ?? currentBooking.modNo,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        if (await handleCommandError(res.status, data, "Lỗi thanh toán")) return;
        throw new Error(data.error || "Không thể bổ sung thanh toán.");
      }

      toast.success(data.message || "Đã bổ sung thanh toán thành công!", "Thanh toán thành công");
      const updated: GanttBookingItem = {
        ...currentBooking,
        paidAmount: data.paidAmount,
        remainingAmount: data.remainingAmount,
        depositStatus: data.depositStatus,
        remainingPaidAt: new Date().toISOString(),
        version: data.booking?.version ?? (currentBooking.version || 0) + 1,
        modNo: data.booking?.mod_no ?? (currentBooking.modNo || 0) + 1,
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
        body: JSON.stringify({
          action: "mark_deposit_reminder_sent",
          expectedVersion: currentBooking.version ?? currentBooking.modNo,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        if (await handleCommandError(res.status, data, "Lỗi nhắc cọc")) return;
        throw new Error(data.error || "Không thể ghi nhận gửi nhắc cọc.");
      }
      toast.success("Đã ghi nhận gửi nhắc cọc cho khách!", "Gửi nhắc thành công");
      const updated: GanttBookingItem = {
        ...currentBooking,
        depositReminderSentAt: data.depositReminderSentAt,
        version: data.booking?.version ?? (currentBooking.version || 0) + 1,
        modNo: data.booking?.mod_no ?? (currentBooking.modNo || 0) + 1,
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
              {currentBooking.channel === "web" && (
                <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">🌐 Khách tự đặt web</span>
              )}
              {currentBooking.voucherCode && (
                <span className="text-[11px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">🎟 {currentBooking.voucherCode}</span>
              )}
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
              initialBooking={currentBooking}
              onSuccess={handleEditSuccess}
              onCancel={() => setMode("view")}
            />
          ) : (
            <>
              {/* Closed booking (cancelled / no-show): read-only state + money trail */}
              {isClosed && <ClosedBookingBanner booking={currentBooking} />}

              {/* Primary Action Buttons (+1h & Edit) */}
              {!isClosed && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={extending || isPastCheckout}
                      onClick={handleExtend1h}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-sm border border-emerald-500 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      title={isPastCheckout ? "Đã qua giờ trả phòng" : "Gia hạn checkout thêm 1 giờ (phí theo bảng giá)"}
                    >
                      {extending ? (
                        <span>Đang thêm 1h...</span>
                      ) : (
                        <>
                          <span>⏱️ +1h Checkout</span>
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
                {(currentBooking.instagram || currentBooking.facebook || currentBooking.zalo) && (
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
                    {currentBooking.zalo && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 font-bold shadow-xs">
                        <span className="text-xs font-bold text-sky-600">Z</span>
                        <span>{currentBooking.zalo}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Loyalty Sync Status Badge (A-W8) */}
                {currentBooking.loyaltySyncStatus && currentBooking.loyaltySyncStatus !== "not_applicable" && (
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Tích lũy thành viên:</span>
                    <div className="flex items-center gap-2">
                      {currentBooking.loyaltySyncStatus === "synced" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                          <span>✓</span> Đã tích lũy
                        </span>
                      )}
                      {currentBooking.loyaltySyncStatus === "pending" && (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                            <span>⏳</span> Đang chờ đồng bộ
                          </span>
                          <button
                            type="button"
                            onClick={handleRetryLoyaltySync}
                            disabled={retryingSync}
                            className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer disabled:opacity-50"
                          >
                            {retryingSync ? "Đang đồng bộ..." : "Đồng bộ ngay"}
                          </button>
                        </div>
                      )}
                      {currentBooking.loyaltySyncStatus === "failed" && (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
                            <span>⚠️</span> Lỗi đồng bộ
                          </span>
                          <button
                            type="button"
                            onClick={handleRetryLoyaltySync}
                            disabled={retryingSync}
                            className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer disabled:opacity-50"
                          >
                            {retryingSync ? "Đang đồng bộ..." : "Thử lại"}
                          </button>
                        </div>
                      )}
                    </div>
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

              {/* Door codes (AI receptionist vault, OD-4) */}
              {!isClosed && (
                <DoorCodeCard bookingId={currentBooking.id} roomId={currentBooking.roomId} checkinAt={currentBooking.checkinAt} checkoutAt={currentBooking.checkoutAt} />
              )}

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
                    {isClosed
                      ? `Đã đóng · giữ lại ${actualCashReceived.toLocaleString("vi-VN")}đ`
                      : currentBooking.isDeposit === 1
                        ? currentBooking.depositStatus === "fully_paid"
                          ? "Đã thu đủ 100%"
                          : "Đơn đặt cọc (Chờ thu nốt)"
                        : (currentBooking.remainingAmount ?? 0) > 0
                          ? `Còn phải thu ${(currentBooking.remainingAmount ?? 0).toLocaleString("vi-VN")}đ`
                          : "Đã thu đủ"}
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-700 font-mono tracking-tight">
                  {Number(currentBooking.totalPrice).toLocaleString("vi-VN")} đ
                </div>

                {/* Itemized 4-part Bill Breakdown */}
                {currentBooking.basePrice !== undefined && (
                  <div className="pt-2 border-t border-emerald-200/60 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Giá cơ bản ({currentBooking.numGuests || 2} khách):</span>
                      <span className="font-mono font-bold text-slate-900">
                        {Number(currentBooking.basePrice).toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                    {(currentBooking.discountAmount || 0) > 0 && (
                      <div className="flex justify-between text-rose-700 font-semibold">
                        <span>Ưu đãi {currentBooking.promotionName ? `(${currentBooking.promotionName})` : ""}:</span>
                        <span className="font-mono font-bold">
                          -{Number(currentBooking.discountAmount).toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    )}
                    {(currentBooking.holidaySurcharge || 0) > 0 && (
                      <div className="flex justify-between text-amber-800 font-semibold">
                        <span>Phụ thu Ngày Lễ:</span>
                        <span className="font-mono font-bold">
                          +{Number(currentBooking.holidaySurcharge).toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    )}
                    {(currentBooking.extraFee || 0) > 0 && (
                      <div className="flex justify-between text-amber-800 font-semibold">
                        <span>Phụ phí giờ thêm:</span>
                        <span className="font-mono font-bold">
                          +{Number(currentBooking.extraFee).toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    )}
                    {(currentBooking.extraGuestFee || 0) > 0 && (
                      <div className="flex justify-between text-indigo-800 font-semibold">
                        <span>Phụ thu khách thứ 3+:</span>
                        <span className="font-mono font-bold">
                          +{Number(currentBooking.extraGuestFee).toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    )}
                    {((currentBooking.incidentalFee || (currentBooking as any).incidental_fee) || 0) > 0 && (
                      <div className="flex justify-between text-purple-800 font-semibold">
                        <span>
                          Phát sinh {(currentBooking.incidentalReason || (currentBooking as any).incidental_reason) ? `(${(currentBooking.incidentalReason || (currentBooking as any).incidental_reason)})` : ""}:
                        </span>
                        <span className="font-mono font-bold">
                          +{Number(currentBooking.incidentalFee || (currentBooking as any).incidental_fee).toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    )}
                  </div>
                )}

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

              {/* Unified cancel flow (reason → refund → confirm); "No-show" is one of the reasons */}
              {showConfirmCancel && canClose && (
                <CancelBookingPanel
                  booking={currentBooking}
                  onClosed={handleBookingClosed}
                  onError={async (status, data) => {
                    if (isVersionConflict(status, data) || status === 409) await refetchBooking();
                  }}
                  onDismiss={() => setShowConfirmCancel(false)}
                />
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {mode === "view" && canClose && !showConfirmCancel && (
              <button
                type="button"
                onClick={() => setShowConfirmCancel(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>⛔</span>
                <span>Huỷ đặt phòng / No-show</span>
              </button>
            )}
            {mode === "view" && !isClosed && !canClose && (
              <span className="text-[11px] text-slate-500 italic">Đã qua giờ trả phòng — không thể huỷ.</span>
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
