"use client";

import React, { useState } from "react";
import type { CoreHoldDto } from "@/lib/coreMappers";
import type { Room } from "@/types";

interface MockPaymentStepProps {
  hold: CoreHoldDto;
  room: Room;
  releasing: boolean;
  onBackToEditInfo: () => void;
  onExitAndReselect: () => void;
  onPaymentConfirmed: (result: {
    booking: any;
    telegramSent: boolean;
    telegramReason: string | null;
  }) => void;
}

function formatDateTimeVn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const MockPaymentStep: React.FC<MockPaymentStepProps> = ({
  hold,
  room,
  releasing,
  onBackToEditInfo,
  onExitAndReselect,
  onPaymentConfirmed,
}) => {
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const draft = hold.checkoutDraft;

  const payableNow = hold.payableAmount;
  const remainingLater = draft?.isDeposit
    ? Math.max(0, hold.quotedTotalPrice - payableNow)
    : 0;

  const handleConfirmMockPayment = async () => {
    setErrorMsg(null);
    setConfirming(true);
    try {
      const res = await fetch(
        `/api/holds/${encodeURIComponent(hold.id)}/confirm-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentMethod: draft?.paymentMethod || "bank_transfer",
            paymentReference: hold.paymentReference || undefined,
          }),
        }
      );

      const data = (await res.json()) as any;
      if (!res.ok) {
        setErrorMsg(
          data.error || "Không thể xác nhận thanh toán. Vui lòng thử lại."
        );
        return;
      }

      onPaymentConfirmed({
        booking: data.booking,
        telegramSent: Boolean(data.telegramSent),
        telegramReason: data.telegramReason ?? null,
      });
    } catch (err) {
      console.error("Confirm mock payment error:", err);
      setErrorMsg("Lỗi kết nối khi xác nhận thanh toán.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold flex items-center gap-2.5">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Payment Card */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-emerald-100 text-[11px] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Bước 3 • Chờ Xác Nhận Thanh Toán</span>
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold">
              {room.name} ({room.room_class.toUpperCase()}) • {hold.numGuests} khách
            </h2>
            <p className="text-xs text-emerald-100/90">
              Khách hàng: <strong>{draft?.guest.name || "—"}</strong> • SĐT:{" "}
              <span className="font-mono">{draft?.guest.phoneRaw || "—"}</span>
            </p>
          </div>

          <div className="sm:text-right bg-black/20 px-4 py-3 rounded-2xl border border-white/10">
            <span className="text-[11px] uppercase tracking-wider text-emerald-200 font-bold block">
              {draft?.isDeposit ? "Tiền cọc cần thu ngay" : "Tổng tiền thanh toán (100%)"}
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              {payableNow.toLocaleString("vi-VN")} đ
            </span>
            {hold.paymentReference && (
              <span className="block text-[11px] font-mono text-emerald-200 mt-0.5">
                Nội dung CK: <strong>{hold.paymentReference}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Booking Details Summary Bar */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              📥 Nhận: <strong className="font-mono">{formatDateTimeVn(hold.checkinAt)}</strong>
            </span>
            <span>
              📤 Trả: <strong className="font-mono">{formatDateTimeVn(hold.checkoutAt)}</strong>
            </span>
            {draft?.isDeposit && (
              <span className="text-amber-800 font-semibold">
                ⏳ Còn lại thu sau: {remainingLater.toLocaleString("vi-VN")} đ
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onBackToEditInfo}
            disabled={confirming || releasing}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer disabled:opacity-50"
          >
            ← Quay lại sửa thông tin khách
          </button>
        </div>

        {/* Empty / Mock Payment Gateway Area (Future Webhook: Casso, PayOS, SePay) */}
        <div className="p-6 sm:p-10 space-y-6">
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-8 sm:p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center text-2xl mx-auto shadow-2xs">
              🏦
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
              Màn Hình Chờ Thanh Toán (Mock Phase 2.1)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Khu vực này được thiết kế sẵn để tích hợp <strong>QR động & Webhook tự động</strong>{" "}
              (Casso / PayOS / SePay) trong bản nâng cấp tiếp theo. Hiện tại lễ tân kiểm tra giao dịch và bấm nút xác nhận bên dưới.
            </p>
            {hold.paymentReference && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-700 shadow-2xs">
                <span>Mã tham chiếu Webhook:</span>
                <strong className="text-emerald-800">{hold.paymentReference}</strong>
              </div>
            )}
          </div>

          {/* Primary Actions: Mock Confirm Payment vs Exit & Reselect */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <button
              type="button"
              onClick={onExitAndReselect}
              disabled={confirming || releasing}
              className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border-2 border-rose-200 hover:border-rose-300 font-extrabold text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>🚪</span>
              <span>{releasing ? "Đang hủy giữ phòng..." : "Thoát & Chọn lại"}</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmMockPayment}
              disabled={confirming || releasing}
              className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              {confirming ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Đang lưu đơn & gửi Telegram...</span>
                </>
              ) : (
                <>
                  <span>✅</span>
                  <span>Xác nhận đã thanh toán</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

