"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Booking, BookingType, PricingRule, Room } from "@/types";
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
  const [booking, setBooking] = useState<Booking | null>(null);

  // Form Fields
  const [roomId, setRoomId] = useState("");
  const [bookingType, setBookingType] = useState<BookingType>("hourly");
  const [note, setNote] = useState("");
  const [closingNote, setClosingNote] = useState("");

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

  // Fetch initial booking details, rooms, and pricing rules
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoadingInitial(true);
        const [bookingRes, roomsRes, pricingRes] = await Promise.all([
          fetch(`/api/bookings/${bookingId}`),
          fetch("/api/rooms"),
          fetch("/api/pricing-rules"),
        ]);

        if (!bookingRes.ok) throw new Error("Không thể tải thông tin đặt phòng.");
        const bookingData = (await bookingRes.json()) as any;
        const roomsData = roomsRes.ok ? (((await roomsRes.json()) as any)) : { rooms: [] };
        const pricingData = pricingRes.ok ? (((await pricingRes.json()) as any)) : { pricingRules: [] };

        if (!isMounted) return;

        const b: Booking = bookingData.booking;
        setBooking(b);
        setRooms(roomsData.rooms || []);
        setPricingRules(pricingData.pricingRules || []);

        setRoomId(b.room_id);
        const type = (b.booking_type as BookingType) || "hourly";
        setBookingType(type);
        setNote(b.note || "");
        setClosingNote(b.closing_note || "");

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
        setCustomPrice(b.total_price || 0);
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || "Lỗi tải dữ liệu đặt phòng.");
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [bookingId]);

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

  // Live Pricing Calculation
  const currentPricing = useMemo(() => {
    if (!selectedRoom || pricingRules.length === 0) return null;
    try {
      return calculatePrice({
        bookingType,
        roomClass: selectedRoom.room_class,
        checkinAt: calculatedCheckinAt,
        checkoutAt: calculatedCheckoutAt,
        lateCheckoutHours: calculatedLateHours,
        pricingRules,
        customPrice,
      });
    } catch {
      return null;
    }
  }, [
    selectedRoom,
    pricingRules,
    bookingType,
    calculatedCheckinAt,
    calculatedCheckoutAt,
    calculatedLateHours,
    customPrice,
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

    try {
      setSubmitting(true);
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          roomId,
          bookingType,
          checkinAt: calculatedCheckinAt.toISOString(),
          checkoutAt: calculatedCheckoutAt.toISOString(),
          lateCheckoutHours: calculatedLateHours,
          customPrice: bookingType === "custom" ? customPrice : 0,
          note,
          closingNote,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        const errorText = data.error || "Không thể cập nhật đặt phòng.";
        if (res.status === 409) {
          toast.warning(errorText, "Xung đột lịch & Giờ dọn phòng");
        } else {
          toast.error(errorText, "Lỗi cập nhật đặt phòng");
        }
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2 shadow-lg">
          <span className="text-base shrink-0">⚠️</span>
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Room Selector */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Chọn Phòng <span className="text-rose-400">*</span>
        </label>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3.5 py-2.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
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

      {/* Live Price Summary Preview */}
      {currentPricing && (
        <PriceSummaryCard pricing={currentPricing} selectedRoom={selectedRoom} />
      )}

      {/* Closing Note / Agreement with Guest */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
          <span>💬</span>
          <span>Câu chốt với khách</span>
        </label>
        <textarea
          rows={2}
          value={closingNote}
          onChange={(e) => setClosingNote(e.target.value)}
          placeholder="VD: Khách chốt nhận phòng lúc 14h, trả phòng 17h, thanh toán tiền mặt tại quầy..."
          className="w-full rounded-xl bg-[#131b28] border border-amber-500/30 px-3.5 py-2 text-xs text-amber-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
        />
      </div>

      {/* Receptionist Notes */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Ghi chú nội bộ của lễ tân
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú nội bộ..."
          className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
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
