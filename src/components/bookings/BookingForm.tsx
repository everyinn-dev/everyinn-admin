"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingRulesConfig, BookingType, Member, PricingRule, Room } from "@/types";
import { calculatePrice } from "@/lib/pricing";
import { PhoneLookupField } from "./PhoneLookupField";
import { BookingTypeTabs } from "./BookingTypeTabs";
import { HourlyFields } from "./HourlyFields";
import { OvernightFields } from "./OvernightFields";
import { DayUseFields } from "./DayUseFields";
import { PriceSummaryCard } from "./PriceSummaryCard";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

interface BookingFormProps {
  initialRooms: Room[];
  initialPricingRules: PricingRule[];
  bookingRules?: BookingRulesConfig;
  hourlySlots?: number[];
}

export const BookingForm: React.FC<BookingFormProps> = ({
  initialRooms,
  initialPricingRules,
  bookingRules,
  hourlySlots,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query param prefill (if receptionist clicked "+ Đặt phòng này" from dashboard)
  const queryRoomId = searchParams.get("roomId");
  const queryDate = searchParams.get("date");

  // Today in Vietnam (UTC+7)
  const defaultDate =
    queryDate || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

  // Form states
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [numGuests, setNumGuests] = useState(2);
  const [roomId, setRoomId] = useState<string>(
    queryRoomId && initialRooms.some((r) => r.id === queryRoomId)
      ? queryRoomId
      : initialRooms[0]?.id || ""
  );
  const [bookingType, setBookingType] = useState<BookingType>("hourly");
  const [note, setNote] = useState("");

  // Hourly specific
  const [hourlyDate, setHourlyDate] = useState(defaultDate);
  const [hourlyCheckinHour, setHourlyCheckinHour] = useState(14); // 14:00 default
  const [hourlyDuration, setHourlyDuration] = useState(3); // 3h combo default

  // Overnight specific
  const [overnightDate, setOvernightDate] = useState(defaultDate);
  const [overnightStartHour, setOvernightStartHour] = useState(22); // 22:00 default
  const [overnightLateHours, setOvernightLateHours] = useState(0);

  // Day use specific
  const [dayuseDate, setDayuseDate] = useState(defaultDate);
  const [dayuseNights, setDayuseNights] = useState(1);
  const [dayuseLateHours, setDayuseLateHours] = useState(0);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Selected room object
  const selectedRoom = useMemo(() => {
    return initialRooms.find((r) => r.id === roomId) || initialRooms[0] || null;
  }, [initialRooms, roomId]);

  // Compute checkin & checkout Date objects
  const { checkinAt, checkoutAt, lateHours } = useMemo(() => {
    if (bookingType === "hourly") {
      const inDate = new Date(`${hourlyDate}T00:00:00`);
      inDate.setHours(hourlyCheckinHour, 0, 0, 0);

      const outDate = new Date(inDate.getTime() + hourlyDuration * 3600 * 1000);
      return { checkinAt: inDate, checkoutAt: outDate, lateHours: 0 };
    }

    if (bookingType === "overnight") {
      const inDate = new Date(`${overnightDate}T00:00:00`);
      inDate.setHours(overnightStartHour, 0, 0, 0);

      const outDate = new Date(`${overnightDate}T00:00:00`);
      // 12 hours basic stay + late checkout hours
      outDate.setHours(overnightStartHour + 12 + overnightLateHours, 0, 0, 0);
      return { checkinAt: inDate, checkoutAt: outDate, lateHours: overnightLateHours };
    }

    // Day use
    const inDate = new Date(`${dayuseDate}T15:00:00`);
    const outDate = new Date(`${dayuseDate}T00:00:00`);
    outDate.setDate(outDate.getDate() + dayuseNights);
    outDate.setHours(12 + dayuseLateHours, 0, 0, 0);
    return { checkinAt: inDate, checkoutAt: outDate, lateHours: dayuseLateHours };
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
  ]);

  // Live pricing
  const pricing = useMemo(() => {
    return calculatePrice({
      bookingType,
      roomClass: selectedRoom?.room_class || "haven",
      checkinAt,
      checkoutAt,
      lateCheckoutHours: lateHours,
      pricingRules: initialPricingRules,
      extraHourFee: bookingRules?.extra_hour_fee,
    });
  }, [bookingType, selectedRoom, checkinAt, checkoutAt, lateHours, initialPricingRules, bookingRules]);

  // CDP Auto-fill callback
  const handleMemberFound = (member: Member) => {
    const memberName = member.full_name || member.fullName;
    if (memberName && !name) {
      setName(memberName);
    }
  };

  const handleMemberNotFound = () => {
    // Keep typed name if any
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!phone.trim()) {
      setErrorMsg("Vui lòng nhập số điện thoại khách hàng.");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("Vui lòng nhập họ và tên khách hàng.");
      return;
    }
    if (!roomId) {
      setErrorMsg("Vui lòng chọn phòng.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        roomId,
        phone: phone.trim(),
        name: name.trim(),
        numGuests,
        bookingType,
        checkinAt: checkinAt.toISOString(),
        checkoutAt: checkoutAt.toISOString(),
        lateCheckoutHours: lateHours,
        note: note.trim(),
        status: "confirmed",
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể tạo đặt phòng.");
      }

      setSuccessMsg(
        `✅ Đã tạo thành công mã đặt phòng #${data.booking.id} cho ${name}! Đang chuyển hướng...`
      );

      setTimeout(() => {
        router.push(`/dashboard?date=${checkinAt.toISOString().slice(0, 10)}`);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi khi tạo đặt phòng.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      {/* Alert Banners */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-sm font-medium flex items-center gap-2 animate-in fade-in">
          <span className="text-lg">⚠</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-semibold flex items-center gap-2 animate-in fade-in">
          <span className="text-lg">🎉</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Customer Information Card */}
      <div className="rounded-2xl bg-[#0d131f] border border-slate-800 p-5 space-y-4 shadow-lg">
        <div className="border-b border-slate-800/80 pb-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <span>👤</span> Thông tin khách hàng (Tích hợp Mini CDP)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PhoneLookupField
            phone={phone}
            onChangePhone={setPhone}
            onMemberFound={handleMemberFound}
            onMemberNotFound={handleMemberNotFound}
          />

          <Input
            label="Họ và tên khách hàng"
            required
            placeholder="Nguyễn Văn A"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase mb-1.5">
              Số lượng khách
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setNumGuests(Math.max(1, numGuests - 1))}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base flex items-center justify-center border border-slate-700 transition-colors"
              >
                −
              </button>
              <span className="font-mono font-bold text-base text-white px-2">
                {numGuests} người
              </span>
              <button
                type="button"
                onClick={() => setNumGuests(Math.min(4, numGuests + 1))}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base flex items-center justify-center border border-slate-700 transition-colors"
              >
                +
              </button>
              <span className="text-xs text-slate-400 pl-2">
                (Tiêu chuẩn 2 người / phòng)
              </span>
            </div>
          </div>

          {/* Room selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase mb-1.5">
              Chọn phòng trống <span className="text-rose-400">*</span>
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold"
            >
              <optgroup label={`Haven (${initialRooms.filter((r) => r.room_class === "haven").length} Phòng - 22m²)`}>
                {initialRooms
                  .filter((r) => r.room_class === "haven")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      Phòng {r.room_number} ({r.name} - Tầng {r.floor})
                    </option>
                  ))}
              </optgroup>
              <optgroup label={`Signature (${initialRooms.filter((r) => r.room_class === "signature").length} Phòng - 28m²)`}>
                {initialRooms
                  .filter((r) => r.room_class === "signature")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      Phòng {r.room_number} ({r.name} - Tầng {r.floor})
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* Booking Type & Time Specs */}
      <div className="rounded-2xl bg-[#0d131f] border border-slate-800 p-5 space-y-5 shadow-lg">
        <BookingTypeTabs
          selectedType={bookingType}
          onChangeType={(type) => setBookingType(type)}
        />

        {/* Conditional Time Fields */}
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
            hourlySlots={hourlySlots}
            extraHourFee={bookingRules?.extra_hour_fee}
            maxLateCheckoutHours={bookingRules?.max_late_checkout_hours}
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

        {/* Internal Receptionist Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase mb-1">
            Ghi chú nội bộ cho lễ tân (Tùy chọn)
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Yêu cầu thêm gối, khách cần hóa đơn, xe gửi bãi ngoài..."
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>
      </div>

      {/* Price Summary Card */}
      <PriceSummaryCard pricing={pricing} selectedRoom={selectedRoom} />

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => router.push("/dashboard")}
        >
          Hủy — Về Bảng Phòng
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={submitting}
          leftIcon={<span>✅</span>}
        >
          Xác Nhận Tạo Đặt Phòng
        </Button>
      </div>
    </form>
  );
};
