"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Booking, BookingType, GanttBookingItem, PricingRule, Room, SurchargeRule } from "@/types";
import { Promotion } from "@/types/promotions";
import { calculatePrice } from "@/lib/pricing";
import { hasMoneyReason, initialCustomPrice, moneyEditState } from "@/lib/bookingEdit";
import { roundToNearest30Min, toVnDateInput, getVnHour } from "@/lib/timelineUtils";
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
  initialBooking?: GanttBookingItem | Booking | null;
  onSuccess: (updatedBooking: Booking) => void;
  onCancel: () => void;
  /** "Huỷ & tạo lại": the booking type cannot be changed here, so the drawer opens the cancel flow instead. */
  onRequestRebook?: () => void;
}

export function extractBookingFields(b: Booking | GanttBookingItem) {
  const roomId = (b as Booking).room_id ?? (b as GanttBookingItem).roomId ?? "";
  const bookingType = ((b as Booking).booking_type ?? (b as GanttBookingItem).bookingType ?? "hourly") as BookingType;
  const note = b.note ?? "";
  const closingNote = (b as any).closingNote ?? (b as any).closing_note ?? "";
  const incidentalFee = (b as any).incidental_fee ?? (b as any).incidentalFee ?? 0;
  const incidentalReason = (b as any).incidental_reason ?? (b as any).incidentalReason ?? "";
  const checkinAt = (b as Booking).checkin_at ?? (b as GanttBookingItem).checkinAt;
  const checkoutAt = (b as Booking).checkout_at ?? (b as GanttBookingItem).checkoutAt;
  const lateCheckoutHours = (b as any).late_checkout_hours ?? (b as GanttBookingItem).lateCheckoutHours ?? 0;
  const totalPrice = (b as any).total_price ?? (b as GanttBookingItem).totalPrice ?? 0;
  const basePrice = (b as any).base_price ?? (b as GanttBookingItem).basePrice ?? 0;
  const extraFee = (b as any).extra_fee ?? (b as GanttBookingItem).extraFee ?? 0;

  const inDate = checkinAt ? new Date(checkinAt) : new Date();
  const outDate = checkoutAt ? new Date(checkoutAt) : new Date();
  const inDateStr = toVnDateInput(inDate);
  const outDateStr = toVnDateInput(outDate);
  const inTimeStr = roundToNearest30Min(inDate);
  const outTimeStr = roundToNearest30Min(outDate);
  const vnInHour = getVnHour(inDate);

  const durationH = Math.max(3, Math.round((outDate.getTime() - inDate.getTime()) / (3600 * 1000)));
  const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (24 * 3600 * 1000)));

  const customPrice = initialCustomPrice({ base_price: basePrice, total_price: totalPrice, incidental_fee: incidentalFee });
  void extraFee;

  return {
    roomId,
    bookingType,
    note,
    closingNote,
    incidentalFee,
    incidentalReason,
    inDateStr,
    outDateStr,
    inTimeStr,
    outTimeStr,
    vnInHour,
    durationH,
    nights,
    lateCheckoutHours,
    customPrice,
  };
}

export const BookingEditForm: React.FC<BookingEditFormProps> = ({
  bookingId,
  initialBooking,
  onSuccess,
  onCancel,
  onRequestRebook,
}) => {
  const toast = useToast();
  const initialFields = useMemo(() => (initialBooking ? extractBookingFields(initialBooking) : null), [initialBooking]);

  const [loadingInitial, setLoadingInitial] = useState(!initialFields);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [surchargeRules, setSurchargeRules] = useState<SurchargeRule[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [booking, setBooking] = useState<Booking | GanttBookingItem | null>(initialBooking || null);

  // Form Fields
  const [roomId, setRoomId] = useState(initialFields?.roomId ?? "");
  const [bookingType, setBookingType] = useState<BookingType>(initialFields?.bookingType ?? "hourly");
  const [note, setNote] = useState(initialFields?.note ?? "");
  const [closingNote, setClosingNote] = useState(initialFields?.closingNote ?? "");

  // Incidental charges are added / voided in the drawer's "Phụ phí & phát sinh" section, not here. The form only
  // shows what the booking already carries so the price preview adds up.
  const [incidentalFee, setIncidentalFee] = useState(initialFields?.incidentalFee ?? 0);
  const [incidentalReason, setIncidentalReason] = useState(initialFields?.incidentalReason ?? "");

  // Hourly fields
  const [hourlyDate, setHourlyDate] = useState(initialFields?.inDateStr ?? "");
  const [hourlyCheckinHour, setHourlyCheckinHour] = useState(initialFields?.vnInHour ?? 14);
  const [hourlyDuration, setHourlyDuration] = useState(initialFields?.durationH ?? 3);

  // Overnight fields
  const [overnightDate, setOvernightDate] = useState(initialFields?.inDateStr ?? "");
  const [overnightStartHour, setOvernightStartHour] = useState(
    initialFields ? (initialFields.vnInHour === 0 ? 24 : initialFields.vnInHour) : 22
  );
  const [overnightLateHours, setOvernightLateHours] = useState(initialFields?.lateCheckoutHours ?? 0);

  // Day use fields
  const [dayuseDate, setDayuseDate] = useState(initialFields?.inDateStr ?? "");
  const [dayuseNights, setDayuseNights] = useState(initialFields?.nights ?? 1);
  const [dayuseLateHours, setDayuseLateHours] = useState(initialFields?.lateCheckoutHours ?? 0);

  // Custom fields
  const [customCheckinDate, setCustomCheckinDate] = useState(initialFields?.inDateStr ?? "");
  const [customCheckinTime, setCustomCheckinTime] = useState(initialFields?.inTimeStr ?? "14:00");
  const [customCheckoutDate, setCustomCheckoutDate] = useState(initialFields?.outDateStr ?? "");
  const [customCheckoutTime, setCustomCheckoutTime] = useState(initialFields?.outTimeStr ?? "12:00");
  const [customPrice, setCustomPrice] = useState(initialFields?.customPrice ?? 0);

  // The type the booking was created with: it cannot be changed on edit (cancel + re-create instead).
  const originalType = useMemo<BookingType>(() => (booking ? extractBookingFields(booking).bookingType : (initialFields?.bookingType ?? "hourly")), [booking, initialFields]);
  const originalFields = useMemo(() => (booking ? extractBookingFields(booking) : initialFields), [booking, initialFields]);

  // Why money changed (custom price / incidental charge): required, goes to the audit trail.
  const [moneyReason, setMoneyReason] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch fresh booking details, rooms, pricing rules, surcharges & promotions
  const loadData = React.useCallback(async () => {
    try {
      if (!initialBooking) setLoadingInitial(true);
      const timestamp = Date.now();
      const [bookingRes, roomsRes, pricingRes, surchargeRes, promoRes] = await Promise.all([
        fetch(`/api/bookings/${bookingId}?_t=${timestamp}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
        }),
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

      const fields = extractBookingFields(b);
      setRoomId(fields.roomId);
      setBookingType(fields.bookingType);
      setNote(fields.note);
      setClosingNote(fields.closingNote);

      setIncidentalFee(fields.incidentalFee);
      setIncidentalReason(fields.incidentalReason);

      // Set date & time fields in Vietnam timezone
      setHourlyDate(fields.inDateStr);
      setHourlyCheckinHour(fields.vnInHour);
      setHourlyDuration(fields.durationH);

      setOvernightDate(fields.inDateStr);
      setOvernightStartHour(fields.vnInHour === 0 ? 24 : fields.vnInHour);
      setOvernightLateHours(fields.lateCheckoutHours);

      setDayuseDate(fields.inDateStr);
      setDayuseNights(fields.nights);
      setDayuseLateHours(fields.lateCheckoutHours);

      setCustomCheckinDate(fields.inDateStr);
      setCustomCheckinTime(fields.inTimeStr);
      setCustomCheckoutDate(fields.outDateStr);
      setCustomCheckoutTime(fields.outTimeStr);
      setCustomPrice(fields.customPrice);
      setMoneyReason("");
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi tải dữ liệu đặt phòng.");
    } finally {
      setLoadingInitial(false);
    }
  }, [bookingId, initialBooking]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selected room
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === roomId) || null;
  }, [rooms, roomId]);

  // Normalize booking getters for both Booking and GanttBookingItem
  const numGuests = (booking as any)?.num_guests ?? (booking as any)?.numGuests ?? 2;
  const promotionName = (booking as any)?.promotion_name ?? (booking as any)?.promotionName ?? null;
  const promotionCode = (booking as any)?.promotion_code ?? (booking as any)?.promotionCode ?? (booking as any)?.voucherCode ?? null;
  const promotionId = (booking as any)?.promotion_id ?? (booking as any)?.promotionId ?? null;
  const bookingDiscountAmount = (booking as any)?.discount_amount ?? (booking as any)?.discountAmount ?? 0;
  const bookingBasePrice = (booking as any)?.base_price ?? (booking as any)?.basePrice ?? 0;

  // Compute calculated checkinAt, checkoutAt, lateHours in Vietnam timezone (+07:00)
  const { calculatedCheckinAt, calculatedCheckoutAt, calculatedLateHours } = useMemo(() => {
    if (bookingType === "hourly") {
      const d = new Date(`${hourlyDate || "2026-01-01"}T${String(hourlyCheckinHour).padStart(2, "0")}:00:00+07:00`);
      const out = new Date(d.getTime() + hourlyDuration * 3600 * 1000);
      return { calculatedCheckinAt: d, calculatedCheckoutAt: out, calculatedLateHours: 0 };
    }

    if (bookingType === "overnight") {
      const startH = overnightStartHour === 24 ? "00" : String(overnightStartHour).padStart(2, "0");
      const d = new Date(`${overnightDate || "2026-01-01"}T${startH}:00:00+07:00`);
      if (overnightStartHour === 24) {
        d.setTime(d.getTime() + 24 * 3600 * 1000);
      }
      const standardOutH = overnightStartHour === 24 ? 12 : overnightStartHour - 12;
      const actualOutH = standardOutH + overnightLateHours;
      const nextDayStartMs = new Date(`${overnightDate || "2026-01-01"}T00:00:00+07:00`).getTime() + 24 * 3600 * 1000;
      const out = new Date(nextDayStartMs + actualOutH * 3600 * 1000);
      return { calculatedCheckinAt: d, calculatedCheckoutAt: out, calculatedLateHours: overnightLateHours };
    }

    if (bookingType === "dayuse") {
      const d = new Date(`${dayuseDate || "2026-01-01"}T15:00:00+07:00`);
      const checkoutBaseMs = new Date(`${dayuseDate || "2026-01-01"}T00:00:00+07:00`).getTime() + dayuseNights * 24 * 3600 * 1000;
      const out = new Date(checkoutBaseMs + (12 + dayuseLateHours) * 3600 * 1000);
      return { calculatedCheckinAt: d, calculatedCheckoutAt: out, calculatedLateHours: dayuseLateHours };
    }

    // Custom
    const d = new Date(`${customCheckinDate || "2026-01-01"}T${customCheckinTime || "14:00"}:00+07:00`);
    const out = new Date(`${customCheckoutDate || "2026-01-01"}T${customCheckoutTime || "12:00"}:00+07:00`);
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
        numGuests,
        pricingRules,
        surchargeRules,
        customPrice,
        discountAmount: 0,
      });

      // Calculate promotion discount for preview if booking has a promotion
      let promoDiscount = 0;
      if (promotionName || promotionId || bookingDiscountAmount > 0) {
        const promo = promotions.find(
          (p) =>
            p.id === promotionId ||
            (promotionCode && p.code?.toUpperCase() === promotionCode.toUpperCase())
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
        } else if (bookingBasePrice > 0 && bookingDiscountAmount > 0) {
          const ratio = bookingDiscountAmount / bookingBasePrice;
          promoDiscount = Math.min(raw.basePrice, Math.round(raw.basePrice * ratio));
        } else {
          promoDiscount = Math.min(raw.basePrice, bookingDiscountAmount);
        }
      }

      const activeIncidental = Math.max(0, Number(incidentalFee) || 0);
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
    numGuests,
    promotionName,
    promotionId,
    promotionCode,
    bookingDiscountAmount,
    bookingBasePrice,
    promotions,
    bookingType,
    calculatedCheckinAt,
    calculatedCheckoutAt,
    calculatedLateHours,
    customPrice,
    incidentalFee,
  ]);

  const moneyState = moneyEditState({ originalType, originalCustomPrice: originalFields?.customPrice ?? customPrice, customPrice });
  const { customPriceChanged, needsReason: needsMoneyReason } = moneyState;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!hasMoneyReason(moneyState, moneyReason)) {
      const err = "Vui lòng nhập lý do khi đổi giá.";
      setErrorMessage(err);
      toast.warning(err, "Thiếu lý do");
      return;
    }

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
      const expectedVer =
        booking?.version ??
        (booking as any)?.mod_no ??
        (booking as any)?.modNo ??
        initialBooking?.version ??
        (initialBooking as any)?.modNo;

      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          expectedVersion: expectedVer,
          roomId,
          // bookingType is deliberately not sent: it is locked to the booking's own type (Core 422 BOOKING_TYPE_LOCKED).
          checkinAt: calculatedCheckinAt.toISOString(),
          checkoutAt: calculatedCheckoutAt.toISOString(),
          lateCheckoutHours: calculatedLateHours,
          // Only a price the receptionist actually changed is sent; an untouched price is never re-sent as a "new base".
          ...(customPriceChanged ? { customPrice } : {}),
          note,
          closingNote,
          ...(needsMoneyReason && moneyReason.trim() ? { reason: moneyReason.trim() } : {}),
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        const errorText = data.error || data.message || "Không thể cập nhật đặt phòng.";
        if (res.status === 409) {
          // 409 has several meanings in Core: a concurrent edit, a room-slot clash, or a booking that is no longer
          // editable (cancelled / no-show). Title the message by its code; the text is Core's own reason.
          const title =
            data.code === "VERSION_CONFLICT"
              ? "Đơn vừa được người khác cập nhật"
              : data.code === "INVALID_STATE"
                ? "Đơn không còn chỉnh sửa được"
                : "Xung đột lịch phòng";
          toast.warning(data.error || data.message || "Dữ liệu đã thay đổi. Đang tải lại dữ liệu mới nhất...", title);
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
      <BookingTypeTabs
        selectedType={bookingType}
        onChangeType={setBookingType}
        lockedType={originalType}
        lockedHint={
          onRequestRebook ? (
            <button
              type="button"
              onClick={onRequestRebook}
              className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              ⛔ Huỷ &amp; tạo lại
            </button>
          ) : null
        }
      />

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
      {promotionName && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 flex items-center justify-between text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="text-lg shrink-0">🎁</span>
            <div>
              <div className="font-extrabold text-rose-950 flex items-center gap-1.5">
                <span>Ưu đãi đang áp dụng:</span>
                <span className="text-rose-700 underline decoration-rose-300">
                  {promotionName} {promotionCode ? `(${promotionCode})` : ""}
                </span>
              </div>
              <p className="text-[11px] text-rose-800/90 mt-0.5">
                Hệ thống tự động bảo lưu và tính lại chiết khấu ưu đãi này khi lưu cập nhật.
              </p>
            </div>
          </div>
          <span className="font-mono font-extrabold text-rose-900 bg-white/90 px-2.5 py-1 rounded-lg border border-rose-200 shadow-2xs shrink-0">
            -{(currentPricing?.discountAmount || bookingDiscountAmount || 0).toLocaleString("vi-VN")} đ
          </span>
        </div>
      )}

      {needsMoneyReason && (
        <div className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
          <label htmlFor="money-reason" className="block text-xs font-bold text-amber-900 uppercase tracking-wide">
            Lý do đổi giá <span className="text-rose-600">*</span>
          </label>
          <input
            id="money-reason"
            type="text"
            maxLength={500}
            value={moneyReason}
            onChange={(e) => setMoneyReason(e.target.value)}
            placeholder="VD: Khách quen, giảm 50k theo thoả thuận"
            className="w-full rounded-xl bg-white border border-amber-300 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20"
          />
          <p className="text-[11px] text-amber-800">Lý do được ghi vào nhật ký của đơn cùng giá trước / sau.</p>
        </div>
      )}

      {/* Live Price Summary Preview */}
      {currentPricing && (
        <PriceSummaryCard
          pricing={currentPricing}
          selectedRoom={selectedRoom}
          numGuests={numGuests}
          promotionName={promotionName || undefined}
          incidentalFee={Math.max(0, Number(incidentalFee) || 0)}
          incidentalReason={incidentalReason ? incidentalReason : undefined}
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
