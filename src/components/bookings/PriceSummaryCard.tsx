"use client";

import React from "react";
import { PricingBreakdown } from "@/lib/pricing";
import { BookingType, Room } from "@/types";
import { getRoomTheme } from "@/lib/roomColors";

export interface GuestSummaryInfo {
  name?: string;
  phone?: string;
  instagram?: string;
  facebook?: string;
  zalo?: string;
  memberTier?: string;
}

export interface StaySummaryDetails {
  bookingType: BookingType;
  checkinAt: Date;
  checkoutAt: Date;
  earlyHours?: number;
  lateHours?: number;
  closingNote?: string;
}

interface PriceSummaryCardProps {
  pricing: PricingBreakdown;
  selectedRoom?: Room | null;
  numGuests?: number;
  promotionName?: string;
  isDeposit?: boolean;
  depositAmount?: number;
  remainingAmount?: number;
  depositDueDate?: string;
  guestInfo?: GuestSummaryInfo;
  stayDetails?: StaySummaryDetails;
}

const WEEKDAYS_VN = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function formatDateTimeVn(d: Date): { time: string; dateStr: string; weekday: string } {
  if (!d || Number.isNaN(d.getTime())) {
    return { time: "--:--", dateStr: "--/--/----", weekday: "---" };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const weekday = WEEKDAYS_VN[d.getDay()] || "";
  return { time, dateStr, weekday };
}

const BOOKING_TYPE_BADGES: Record<string, { label: string; icon: string; bg: string }> = {
  hourly: { label: "Theo Giờ", icon: "⏱️", bg: "bg-blue-50 text-blue-800 border-blue-200" },
  overnight: { label: "Qua Đêm", icon: "🌙", bg: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  dayuse: { label: "Theo Ngày", icon: "☀️", bg: "bg-amber-50 text-amber-800 border-amber-200" },
  custom: { label: "Tuỳ Chỉnh", icon: "✨", bg: "bg-purple-50 text-purple-800 border-purple-200" },
};

const TIER_BADGES: Record<string, { label: string; bg: string }> = {
  bronze: { label: "🥉 Hạng Đồng", bg: "bg-amber-100 text-amber-900 border-amber-300" },
  silver: { label: "🥈 Hạng Bạc", bg: "bg-slate-100 text-slate-800 border-slate-300" },
  gold: { label: "🥇 Hạng Vàng", bg: "bg-yellow-100 text-yellow-900 border-yellow-300" },
};

export const PriceSummaryCard: React.FC<PriceSummaryCardProps> = ({
  pricing,
  selectedRoom,
  numGuests = 2,
  promotionName,
  isDeposit,
  depositAmount = 0,
  remainingAmount = 0,
  depositDueDate,
  guestInfo,
  stayDetails,
}) => {
  const roomTheme = selectedRoom ? getRoomTheme(selectedRoom.room_number) : null;

  // Formatting dates & stay durations
  const checkinFmt = stayDetails ? formatDateTimeVn(stayDetails.checkinAt) : null;
  const checkoutFmt = stayDetails ? formatDateTimeVn(stayDetails.checkoutAt) : null;

  // Compute duration description
  const durationDesc = React.useMemo(() => {
    if (!stayDetails) return pricing.durationLabel || "";
    const ms = stayDetails.checkoutAt.getTime() - stayDetails.checkinAt.getTime();
    const hours = Math.round(ms / (3600 * 1000));
    if (stayDetails.bookingType === "hourly") {
      return `${hours} giờ (${pricing.comboLabel})`;
    }
    if (stayDetails.bookingType === "overnight") {
      return `1 đêm (${hours} giờ lưu trú)`;
    }
    if (stayDetails.bookingType === "dayuse") {
      return `${pricing.nightsCount} đêm (${hours} giờ lưu trú)`;
    }
    return `${hours} giờ`;
  }, [stayDetails, pricing]);

  const hasBookingDetails = Boolean(guestInfo || stayDetails);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-50/70 via-slate-50 to-white border border-emerald-300/90 p-5 shadow-xs space-y-4">
      {/* 1. Header with Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider block flex items-center gap-1.5">
            <span>📋</span>
            <span>{hasBookingDetails ? "Tóm Tắt Đặt Phòng & Chi Phí" : "Tóm Tắt Chi Phí (Bill 4 Phần)"}</span>
          </span>
          <span className="text-xs text-slate-600 font-medium">
            Rà soát lại toàn bộ thông tin khách, phòng, giờ nhận/trả và chi phí
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedRoom && roomTheme && (
            <span
              className={`px-3 py-1 rounded-xl text-xs font-mono font-extrabold border shadow-2xs ${roomTheme.badgeSoft}`}
            >
              Phòng {selectedRoom.room_number} ({selectedRoom.room_class.toUpperCase()})
            </span>
          )}
          <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold">
            {pricing.comboLabel}
          </span>
        </div>
      </div>

      {/* 2. Detailed Booking Information Box (Guest + Schedule) */}
      {hasBookingDetails && (
        <div className="rounded-xl bg-white border border-slate-200/90 p-4 shadow-2xs space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Customer Info */}
            <div className="space-y-2 text-xs">
              <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <span>👤</span> Thông Tin Khách Hàng
              </span>

              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-500">Họ và tên:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {guestInfo?.name?.trim() ? (
                      guestInfo.name
                    ) : (
                      <span className="text-slate-400 font-normal italic">Chưa nhập tên khách</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Số điện thoại:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900">
                      {guestInfo?.phone?.trim() ? (
                        guestInfo.phone
                      ) : (
                        <span className="text-slate-400 font-normal italic">Chưa nhập SĐT</span>
                      )}
                    </span>
                    {guestInfo?.memberTier && TIER_BADGES[guestInfo.memberTier] && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                          TIER_BADGES[guestInfo.memberTier].bg
                        }`}
                      >
                        {TIER_BADGES[guestInfo.memberTier].label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Số lượng khách:</span>
                  <span className="font-semibold text-slate-800">
                    👥 {numGuests} người{" "}
                    <span className="text-[11px] text-slate-500">
                      (Tối đa {selectedRoom?.max_guests || 2} khách)
                    </span>
                  </span>
                </div>

                {/* Social media presence */}
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-500 text-[11px]">Kênh liên hệ:</span>
                  {guestInfo?.instagram && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-medium font-mono">
                      IG: @{guestInfo.instagram}
                    </span>
                  )}
                  {guestInfo?.facebook && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
                      FB: {guestInfo.facebook}
                    </span>
                  )}
                  {guestInfo?.zalo && (
                    <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-medium font-mono">
                      Zalo: {guestInfo.zalo}
                    </span>
                  )}
                  {!guestInfo?.instagram && !guestInfo?.facebook && !guestInfo?.zalo && (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10.5px] border border-amber-200 font-medium">
                      Chưa nhập MXH
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Stay Schedule & Room Details */}
            <div className="space-y-2 text-xs">
              <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <span>🕒</span> Lịch Trình Nhận & Trả Phòng
              </span>

              <div className="space-y-2 pt-0.5">
                {/* Checkin Row */}
                <div className="flex items-start justify-between bg-emerald-50/50 p-2 rounded-xl border border-emerald-100">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                      Giờ nhận phòng (Check-in)
                    </span>
                    <div className="text-sm font-extrabold text-emerald-950 font-mono flex items-center gap-1.5">
                      <span>🕒 {checkinFmt?.time}</span>
                      <span className="text-xs font-semibold text-emerald-800">
                        ({checkinFmt?.weekday}, {checkinFmt?.dateStr})
                      </span>
                    </div>
                  </div>
                  {stayDetails?.earlyHours && stayDetails.earlyHours > 0 ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold">
                      Sớm +{stayDetails.earlyHours}h
                    </span>
                  ) : null}
                </div>

                {/* Checkout Row */}
                <div className="flex items-start justify-between bg-rose-50/50 p-2 rounded-xl border border-rose-100">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-rose-800 tracking-wider block">
                      Giờ trả phòng (Check-out)
                    </span>
                    <div className="text-sm font-extrabold text-rose-950 font-mono flex items-center gap-1.5">
                      <span>🕛 {checkoutFmt?.time}</span>
                      <span className="text-xs font-semibold text-rose-800">
                        ({checkoutFmt?.weekday}, {checkoutFmt?.dateStr})
                      </span>
                    </div>
                  </div>
                  {stayDetails?.lateHours && stayDetails.lateHours > 0 ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold">
                      Muộn +{stayDetails.lateHours}h
                    </span>
                  ) : null}
                </div>

                {/* Stay Type & Duration Badge */}
                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <span className="text-slate-500">Hình thức & thời lượng:</span>
                  <div className="flex items-center gap-1.5">
                    {stayDetails && BOOKING_TYPE_BADGES[stayDetails.bookingType] && (
                      <span
                        className={`px-2 py-0.5 rounded-lg border font-bold text-[10.5px] ${
                          BOOKING_TYPE_BADGES[stayDetails.bookingType].bg
                        }`}
                      >
                        {BOOKING_TYPE_BADGES[stayDetails.bookingType].icon}{" "}
                        {BOOKING_TYPE_BADGES[stayDetails.bookingType].label}
                      </span>
                    )}
                    <span className="font-semibold text-slate-800">{durationDesc}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Closing Note / Agreement with Guest Banner */}
          {stayDetails?.closingNote?.trim() && (
            <div className="pt-2.5 border-t border-slate-100">
              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-xs text-amber-950 space-y-1">
                <span className="font-extrabold text-amber-900 uppercase tracking-wide text-[10.5px] flex items-center gap-1">
                  <span>💬</span> Thỏa thuận đã chốt với khách:
                </span>
                <p className="font-medium italic leading-relaxed">&ldquo;{stayDetails.closingNote}&rdquo;</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Itemized Cost Breakdown (4-Part Bill Formula) */}
      <div className="space-y-2 text-xs pt-1">
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
          Chi tiết bảng kê chi phí (Bill 4 phần):
        </span>

        {/* 1. Base Price */}
        <div className="flex justify-between text-slate-700 bg-white/60 p-1.5 px-2.5 rounded-lg border border-slate-100">
          <span>1. Giá cơ bản ({pricing.durationLabel}):</span>
          <span className="font-mono font-bold text-slate-900">
            {pricing.basePrice.toLocaleString("vi-VN")} đ
          </span>
        </div>

        {/* 2. Promotion Discount (strictly on Base Price) */}
        {pricing.discountAmount > 0 && (
          <div className="flex justify-between text-rose-700 font-semibold bg-rose-50/60 p-1.5 px-2.5 rounded-lg border border-rose-100">
            <span>
              2. Ưu đãi giảm trên giá cơ bản {promotionName ? `(${promotionName})` : ""}:
            </span>
            <span className="font-mono font-bold text-rose-800">
              -{pricing.discountAmount.toLocaleString("vi-VN")} đ
            </span>
          </div>
        )}

        {/* 3. Holiday Surcharge (on Base Price per night) */}
        {pricing.holidaySurcharge > 0 && (
          <div className="space-y-1 bg-amber-50/60 p-1.5 px-2.5 rounded-lg border border-amber-100">
            <div className="flex justify-between text-amber-800 font-semibold">
              <span>3. Phụ thu Ngày Lễ/Tết (trên giá cơ bản):</span>
              <span className="font-mono font-bold text-amber-900">
                +{pricing.holidaySurcharge.toLocaleString("vi-VN")} đ
              </span>
            </div>
            {pricing.nightlyBreakdown.filter((n) => (n.holidaySurchargeAmount ?? n.holidaySurcharge ?? 0) > 0).length > 0 && (
              <div className="pl-3 border-l-2 border-amber-300 space-y-0.5 text-[11px] text-amber-700">
                {pricing.nightlyBreakdown
                  .filter((n) => (n.holidaySurchargeAmount ?? n.holidaySurcharge ?? 0) > 0)
                  .map((n) => (
                    <div key={n.stayDate} className="flex justify-between">
                      <span>
                        • Đêm {n.stayDate} ({n.holidayRuleName || `+${n.holidaySurchargePercent || 0}%`}):
                      </span>
                      <span className="font-mono">
                        +{((n.holidaySurchargeAmount ?? n.holidaySurcharge ?? 0)).toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* 4a. Extra Hours Surcharge */}
        {pricing.totalExtraFee > 0 && (
          <div className="flex justify-between text-amber-800 font-semibold bg-amber-50/60 p-1.5 px-2.5 rounded-lg border border-amber-100">
            <span>
              4. Phụ phí thêm giờ (
              {pricing.earlyCheckinHours > 0 ? `Sớm ${pricing.earlyCheckinHours}h` : ""}
              {pricing.earlyCheckinHours > 0 && pricing.lateCheckoutHours > 0 ? " + " : ""}
              {pricing.lateCheckoutHours > 0 ? `Muộn ${pricing.lateCheckoutHours}h` : ""}
              {pricing.earlyCheckinHours === 0 && pricing.lateCheckoutHours === 0
                ? `${pricing.extraHours}h`
                : ""}{" "}
              × {pricing.extraHourFee.toLocaleString("vi-VN")}đ):
            </span>
            <span className="font-mono font-bold text-amber-900">
              +{pricing.totalExtraFee.toLocaleString("vi-VN")} đ
            </span>
          </div>
        )}

        {/* 4b. Extra Guest Surcharge */}
        {pricing.extraGuestFee > 0 && (
          <div className="flex justify-between text-indigo-800 font-semibold bg-indigo-50/60 p-1.5 px-2.5 rounded-lg border border-indigo-100">
            <span>
              Phụ thu khách thêm ({Math.max(0, numGuests - 2)} người × 150.000đ × {pricing.nightsCount} đêm):
            </span>
            <span className="font-mono font-bold text-indigo-900">
              +{pricing.extraGuestFee.toLocaleString("vi-VN")} đ
            </span>
          </div>
        )}
      </div>

      {/* 4. Total Section */}
      <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
        <div>
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">
            TỔNG GIÁ TRỊ ĐƠN
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">
            {isDeposit ? "Đơn có đặt cọc giữ phòng" : "Thu tiền trực tiếp tại quầy"}
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tracking-tight">
            {pricing.totalPrice.toLocaleString("vi-VN")} đ
          </div>
        </div>
      </div>

      {/* 5. Deposit Breakdown */}
      {isDeposit && (
        <div className="pt-3 border-t border-dashed border-amber-300 bg-amber-50/80 -mx-5 -mb-5 p-4 rounded-b-2xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <span>🔒</span> Tiền cọc thu ngay khi chốt:
            </span>
            <span className="font-mono font-extrabold text-amber-900 text-sm">
              {depositAmount.toLocaleString("vi-VN")} đ
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 flex items-center gap-1.5">
              <span>⏳</span> Còn lại cần thu nốt:
            </span>
            <span className="font-mono font-bold text-slate-800">
              {remainingAmount.toLocaleString("vi-VN")} đ
            </span>
          </div>
          {depositDueDate && (
            <div className="text-[11px] text-amber-800 bg-white/80 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center justify-between font-medium">
              <span>Hạn thanh toán số tiền còn lại:</span>
              <span className="font-bold font-mono">
                {new Date(depositDueDate).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
