"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Booking, BookingType, PricingRule, Room, SurchargeRule } from "@/types";
import { Promotion } from "@/types/promotions";
import { calculatePrice } from "@/lib/pricing";
import { roundToNearest30Min } from "@/lib/timelineUtils";
import { BookingTypeTabs } from "../bookings/BookingTypeTabs";
import { HourlyFields } from "../bookings/HourlyFields";
import { OvernightFields } from "../bookings/OvernightFields";
import { DayUseFields } from "../bookings/DayUseFields";
import { CustomFields } from "../bookings/CustomFields";
import { PriceSummaryCard } from "../bookings/PriceSummaryCard";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { useToast } from "../ui/Toast";

interface BookingEditFormProps {
  bookingId: string;
  onSuccess: (updatedBooking: Booking) => void;
  onCancel: () => void;
}

export const BookingEditForm: React.FC<BookingEditFormProps> = ({
  bookingId,
  onSuccess,
  onCancel,
}) => {
  const toast = useToast();
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [surchargeRules, setSurchargeRules] = useState<SurchargeRule[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);

  // Form Fields
  const [roomId, setRoomId] = useState("");
  const [bookingType, setBookingType] = useState<BookingType>("hourly");
  const [note, setNote] = useState("");
  const [closingNote, setClosingNote] = useState("");

  // Incidental charges state ("Thêm phát sinh")
  const [showIncidental, setShowIncidental] = useState(false);
  const [incidentalFee, setIncidentalFee] = useState(0);
  const [incidentalReason, setIncidentalReason] = useState("");

  // Hourly fields
  const [hourlyDate, setHourlyDate] = useState("");
  const [hourlyCheckinHour, setHourlyCheckinHour] = useState(14);
  const [hourlyDuration, setHourlyDuration] = useState(3);

  // Overnight fields
  const [overnightDate, setOvernightDate] = useState("");
  const [overnightStartHour, setOvernightStartHour] = useState(22);
  const [overnightLateHours, setOvernightLateHours] = useState(0);

  // Day use fields
  const [dayuseDate, setDayuseDate] = useState("");
  const [dayuseNights, setDayuseNights] = useState(1);
  const [dayuseLateHours, setDayuseLateHours] = useState(0);

  // Custom fields
  const [customCheckinDate, setCustomCheckinDate] = useState("");
  const [customCheckinTime, setCustomCheckinTime] = useState("14:00");
  const [customCheckoutDate, setCustomCheckoutDate] = useState("");
  const [customCheckoutTime, setCustomCheckoutTime] = useState("12:00");
  const [customPrice, setCustomPrice] = useState(0);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch initial booking details, rooms, pricing rules, surcharges & promotions
  const loadData = React.useCallback(async () => {
    try {
      setLoadingInitial(true);
      const [bookingRes, roomsRes, pricingRes, surchargeRes, promoRes] = await Promise.all([
        fetch(`/api/bookings/${bookingId}`),
        fetch("/api/rooms"),
        fetch("/api/pricing-rules"),
        fetch("/api/surcharges"),
        fetch("/api/promotions"),
      ]);

      if (!bookingRes.ok) throw new Error("Không thể tải thông tin đặt phòng.");
      const bookingData = (await bookingRes.json()) as any;
      const roomsData = roomsRes.ok ? (((await roomsRes.json()) as any)) : { rooms: [] };
      const pricingData = pricingRes.ok ? (((await pricingRes.json()) as any)) : { pricingRules: [] };
      const surchargeData = surchargeRes.ok ? (((await surchargeRes.json()) as any)) : { surchargeRules: [] };
      const promoData = promoRes.ok ? (((await promoRes.json()) as any)) : { promotions: [] };

      const b: Booking = bookingData.booking;
      setBooking(b);
      setRooms(roomsData.rooms || []);
      setPricingRules(pricingData.pricingRules || []);
      setSurchargeRules(surchargeData.surchargeRules || []);
      setPromotions(promoData.promotions || []);

      setRoomId(b.room_id);
      const type = (b.booking_type as BookingType) || "hourly";
      setBookingType(type);
      setNote(b.note || "");
      setClosingNote(b.closing_note || "");

      // Initialize Incidental fee if existing on booking
      const existingIncidental = b.incidental_fee || 0;
      setIncidentalFee(existingIncidental);
      setIncidentalReason(b.incidental_reason || "");
      setShowIncidental(existingIncidental > 0);

      const inDate = new Date(b.checkin_at);
      const outDate = new Date(b.checkout_at);
      const inDateStr = b.checkin_at.slice(0, 10);
      const outDateStr = b.checkout_at.slice(0, 10);

      const inTimeStr = roundToNearest30Min(inDate);
      const outTimeStr = roundToNearest30Min(outDate);

      // Initialize Hourly
      setHourlyDate(inDateStr);
      setHourlyCheckinHour(inDate.getHours());
      const durationH = Math.max(3, Math.round((outDate.getTime() - inDate.getTime()) / (3600 * 1000)));
      setHourlyDuration(durationH);

      // Initialize Overnight
      setOvernightDate(inDateStr);
      setOvernightStartHour(inDate.getHours());
      setOvernightLateHours(b.late_checkout_hours || 0);

      // Initialize DayUse
      setDayuseDate(inDateStr);
      const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (24 * 3600 * 1000)));
      setDayuseNights(nights);
      setDayuseLateHours(b.late_checkout_hours || 0);

      // Initialize Custom (snapped to 30-minute steps)
      setCustomCheckinDate(inDateStr);
      setCustomCheckinTime(inTimeStr);
      setCustomCheckoutDate(outDateStr);
      setCustomCheckoutTime(outTimeStr);
      setCustomPrice(b.base_price || b.total_price || 0);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi tải dữ liệu đặt phòng.");
    } finally {
      setLoadingInitial(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selected room
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === roomId) || null;
  }, [rooms, roomId]);

  // Compute calculated checkinAt, checkoutAt, lateHours
  const { calculatedCheckinAt, calculatedCheckoutAt, calculatedLateHours } = useMemo(() => {
    if (bookingType === "hourly") {
      const d = new Date(`${hourlyDate || "2026-01-01"}T00:00:00`);
      d.setHours(hourlyCheckinHour, 0, 0, 0);
      const out = new Date(d.getTime() + hourlyDuration * 3600 * 1000);
      return { calculatedCheckinAt: d, calculatedCheckoutAt: out, calculatedLateHours: 0 };
    }

    if (bookingType === "overnight") {
      const d = new Date(`${overnightDate || "2026-01-01"}T00:00:00`);
      d.setHours(overnightStartHour, 0, 0, 0);
      const out = new Date(`${overnightDate || "2026-01-01"}T00:00:00`);
      out.setHours(overnightStartHour + 12 + overnightLateHours, 0, 0, 0);
      return { calculatedCheckinAt: d, calculatedCheckoutAt: out, calculatedLateHours: overnightLateHours };
    }

    if (bookingType === "dayuse") {
      const d = new Date(`${dayuseDate || "2026-01-01"}T15:00:00`);
      const out = new Date(`${dayuseDate || "2026-01-01"}T15:00:00`);
      out.setDate(out.getDate() + dayuseNights);
      out.setHours(12 + dayuseLateHours, 0, 0, 0);
      return { calculatedCheckinAt: d, calculatedCheckoutAt: out, calculatedLateHours: dayuseLateHours };
    }

    // Custom
    const d = new Date(`${customCheckinDate || "2026-01-01"}T${customCheckinTime || "14:00"}:00`);
    const out = new Date(`${customCheckoutDate || "2026-01-01"}T${customCheckoutTime || "12:00"}:00`);
    return { calculatedCheckinAt: d, calculatedCheckoutAt: out, calculatedLateHours: 0 };
  }, [
    bookingType,
    hourlyDate,
    hourlyCheckinHour,
    hourlyDuration,
    overnightDate,
    overnightStartHour,
    overnightLateHours,
    dayuseDate,
    dayuseNights,
    dayuseLateHours,
    customCheckinDate,
    customCheckinTime,
    customCheckoutDate,
    customCheckoutTime,
  ]);

  // Live Pricing Calculation (with promo discount and incidental fee added)
  const currentPricing = useMemo(() => {
    if (!selectedRoom || pricingRules.length === 0) return null;
    try {
      const raw = calculatePrice({
        bookingType,
        roomClass: selectedRoom.room_class,
        checkinAt: calculatedCheckinAt,
        checkoutAt: calculatedCheckoutAt,
        earlyCheckinHours: 0,
        lateCheckoutHours: calculatedLateHours,
        numGuests: booking?.num_guests || 2,
        pricingRules,
        surchargeRules,
        customPrice,
        discountAmount: 0,
      });

      // Calculate promotion discount for preview if booking has a promotion
      let promoDiscount = 0;
      if (booking?.promotion_name || booking?.promotion_id || (booking?.discount_amount && booking.discount_amount > 0)) {
        const promo = promotions.find(
          (p) =>
            p.id === booking.promotion_id ||
            (booking.promotion_code && p.code?.toUpperCase() === booking.promotion_code.toUpperCase())
        );

        if (promo) {
          if (promo.discount_type === "percentage") {
            const rawDiscount = Math.round(raw.basePrice * (promo.discount_value / 100));
            promoDiscount = promo.max_discount_amount
              ? Math.min(rawDiscount, promo.max_discount_amount, raw.basePrice)
              : Math.min(rawDiscount, raw.basePrice);
          } else {
            promoDiscount = Math.min(promo.discount_value, raw.basePrice);
          }
        } else if (booking.base_price > 0 && booking.discount_amount > 0) {
          const ratio = booking.discount_amount / booking.base_price;
          promoDiscount = Math.min(raw.basePrice, Math.round(raw.basePrice * ratio));
        } else {
          promoDiscount = Math.min(raw.basePrice, booking.discount_amount || 0);
        }
      }

      const activeIncidental = showIncidental ? Math.max(0, Number(incidentalFee) || 0) : 0;
      const totalBeforeIncidental = Math.max(
        0,
        raw.basePrice + raw.holidaySurcharge + raw.totalExtraFee + raw.extraGuestFee - promoDiscount
      );
      const finalTotal = totalBeforeIncidental + activeIncidental;

      return {
        ...raw,
        discountAmount: promoDiscount,
        totalPrice: finalTotal,
      };
    } catch {
      return null;
    }
  }, [
    selectedRoom,
    pricingRules,
    surchargeRules,
    booking,
    promotions,
    bookingType,
    calculatedCheckinAt,
    calculatedCheckoutAt,
    calculatedLateHours,
    customPrice,
    showIncidental,
    incidentalFee,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!selectedRoom) {
      const err = "Vui lòng chọn phòng hợp lệ.";
      setErrorMessage(err);
      toast.warning(err, "Thiếu thông tin");
      return;
    }

    if (calculatedCheckoutAt <= calculatedCheckinAt) {
      const err = "Thời gian trả phòng phải sau thời gian nhận phòng.";
      setErrorMessage(err);
      toast.warning(err, "Lỗi thời gian");
      return;
    }

    if (!closingNote || closingNote.trim().length < 3) {
      const err = "Vui lòng nhập 'Câu chốt với khách' (bắt buộc tối thiểu 3 ký tự).";
      setErrorMessage(err);
      toast.warning(err, "Thiếu Câu chốt với khách");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          expectedVersion: booking?.mod_no ?? (booking as any)?.version,
          roomId,
          bookingType,
          checkinAt: calculatedCheckinAt.toISOString(),
          checkoutAt: calculatedCheckoutAt.toISOString(),
          lateCheckoutHours: calculatedLateHours,
          customPrice: bookingType === "custom" ? customPrice : 0,
          note,
          closingNote,
          incidentalFee: showIncidental ? Math.max(0, Number(incidentalFee) || 0) : 0,
          incidentalReason: showIncidental && incidentalReason ? incidentalReason.trim() : null,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        const errorText = data.error || "Không thể cập nhật đặt phòng.";
        if (res.status === 409) {
          toast.warning(
            "Dữ liệu hoặc lịch phòng đã bị thay đổi bởi người khác. Đang tải lại dữ liệu mới nhất...",
            "Xung đột lịch & Giờ dọn phòng (409)"
          );
          await loadData();
          return;
        }
        toast.error(errorText, "Lỗi cập nhật đặt phòng");
        throw new Error(errorText);
      }

      onSuccess(data.booking);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi cập nhật đặt phòng.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <Spinner size="md" />
        <p className="text-xs text-slate-400">Đang tải dữ liệu phòng & biểu phí...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-start gap-2 shadow-xs">
          <span className="text-base shrink-0">⚠️</span>
          <div className="leading-relaxed font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Room Selector */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
          Chọn Phòng <span className="text-rose-500">*</span>
        </label>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} — {r.room_class === "haven" ? "Haven (Ban công)" : "Signature (Bồn tắm)"} (Tầng {r.floor})
            </option>
          ))}
        </select>
      </div>

      {/* Booking Type Selector */}
      <BookingTypeTabs selectedType={bookingType} onChangeType={setBookingType} />

      {/* Form Fields Based on Booking Type */}
      {bookingType === "hourly" && (
        <HourlyFields
          checkinDate={hourlyDate}
          checkinHour={hourlyCheckinHour}
          durationHours={hourlyDuration}
          onChangeDate={setHourlyDate}
          onChangeHour={setHourlyCheckinHour}
          onChangeDuration={setHourlyDuration}
        />
      )}

      {bookingType === "overnight" && (
        <OvernightFields
          checkinDate={overnightDate}
          startHour={overnightStartHour}
          lateCheckoutHours={overnightLateHours}
          onChangeDate={setOvernightDate}
          onChangeStartHour={setOvernightStartHour}
          onChangeLateCheckout={setOvernightLateHours}
        />
      )}

      {bookingType === "dayuse" && (
        <DayUseFields
          checkinDate={dayuseDate}
          nights={dayuseNights}
          lateCheckoutHours={dayuseLateHours}
          onChangeDate={setDayuseDate}
          onChangeNights={setDayuseNights}
          onChangeLateCheckout={setDayuseLateHours}
        />
      )}

      {bookingType === "custom" && (
        <CustomFields
          checkinDate={customCheckinDate}
          checkinTime={customCheckinTime}
          checkoutDate={customCheckoutDate}
          checkoutTime={customCheckoutTime}
          customPrice={customPrice}
          onChangeCheckinDate={setCustomCheckinDate}
          onChangeCheckinTime={setCustomCheckinTime}
          onChangeCheckoutDate={setCustomCheckoutDate}
          onChangeCheckoutTime={setCustomCheckoutTime}
          onChangeCustomPrice={setCustomPrice}
        />
      )}

      {/* Promotion Applied Notice & Tag */}
      {booking?.promotion_name && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 flex items-center justify-between text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="text-lg shrink-0">🎁</span>
            <div>
              <div className="font-extrabold text-rose-950 flex items-center gap-1.5">
                <span>Ưu đãi đang áp dụng:</span>
                <span className="text-rose-700 underline decoration-rose-300">
                  {booking.promotion_name} {booking.promotion_code ? `(${booking.promotion_code})` : ""}
                </span>
              </div>
              <p className="text-[11px] text-rose-800/90 mt-0.5">
                Hệ thống tự động bảo lưu và tính lại chiết khấu ưu đãi này khi lưu cập nhật.
              </p>
            </div>
          </div>
          <span className="font-mono font-extrabold text-rose-900 bg-white/90 px-2.5 py-1 rounded-lg border border-rose-200 shadow-2xs shrink-0">
            -{(currentPricing?.discountAmount || booking.discount_amount || 0).toLocaleString("vi-VN")} đ
          </span>
        </div>
      )}

      {/* Incidental / Surcharge Section (Nút Thêm Phát Sinh) */}
      {!showIncidental ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowIncidental(true)}
            className="w-full py-2.5 px-3.5 rounded-xl border border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/50 hover:bg-purple-50 text-purple-900 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <span>➕</span>
            <span>Thêm phát sinh</span>
            <span className="text-[11px] font-normal text-purple-700">(Đền bù, bán thêm dịch vụ, tips...)</span>
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50/80 to-indigo-50/60 border border-purple-200 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-950 uppercase tracking-wide flex items-center gap-1.5">
              <span>⚡</span> Chi phí phát sinh cộng thêm
            </span>
            <button
              type="button"
              onClick={() => {
                setShowIncidental(false);
                setIncidentalFee(0);
                setIncidentalReason("");
              }}
              className="text-xs text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
            >
              ✕ Xóa phát sinh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-purple-900">
                Số tiền phát sinh (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={incidentalFee || ""}
                onChange={(e) => setIncidentalFee(Math.max(0, Number(e.target.value) || 0))}
                placeholder="VD: 150000"
                className="w-full rounded-lg bg-white border border-purple-300 px-3 py-1.5 text-sm font-mono font-bold text-purple-950 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-purple-900">
                Lý do / Nội dung phát sinh
              </label>
              <input
                type="text"
                value={incidentalReason}
                onChange={(e) => setIncidentalReason(e.target.value)}
                placeholder="VD: Đền bù vỡ ly, minibar 2 lon nước, giặt ủi..."
                className="w-full rounded-lg bg-white border border-purple-300 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20"
              />
            </div>
          </div>

          <p className="text-[11px] text-purple-800/90 italic">
            💡 Số tiền phát sinh được cộng thẳng vào tổng thanh toán cuối cùng của đơn (không áp dụng chiết khấu mã khuyến mãi).
          </p>
        </div>
      )}

      {/* Live Price Summary Preview */}
      {currentPricing && (
        <PriceSummaryCard
          pricing={currentPricing}
          selectedRoom={selectedRoom}
          numGuests={booking?.num_guests || 2}
          promotionName={booking?.promotion_name || undefined}
          incidentalFee={showIncidental ? Math.max(0, Number(incidentalFee) || 0) : 0}
          incidentalReason={showIncidental && incidentalReason ? incidentalReason : undefined}
        />
      )}

      {/* Closing Note / Agreement with Guest */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
          <span>💬</span>
          <span>Câu chốt với khách</span>
        </label>
        <textarea
          rows={2}
          value={closingNote}
          onChange={(e) => setClosingNote(e.target.value)}
          placeholder="VD: Khách chốt nhận phòng lúc 14h, trả phòng 17h, thanh toán tiền mặt tại quầy..."
          className="w-full rounded-xl bg-amber-50/50 border border-amber-300 px-3.5 py-2 text-xs text-amber-950 placeholder-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 shadow-xs"
        />
      </div>

      {/* Receptionist Notes */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
          Ghi chú nội bộ của lễ tân
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú nội bộ..."
          className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-xs"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          isLoading={submitting}
        >
          ✅ Xác nhận cập nhật
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={onCancel}
        >
          ← Hủy bỏ
        </Button>
      </div>
    </form>
  );
};
