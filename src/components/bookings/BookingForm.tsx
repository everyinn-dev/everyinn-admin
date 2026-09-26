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
import { CustomFields } from "./CustomFields";
import { PriceSummaryCard } from "./PriceSummaryCard";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

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
  const toast = useToast();
  const searchParams = useSearchParams();

  // Query param prefill (if receptionist clicked "+ Đặt phòng này" from dashboard)
  const queryRoomId = searchParams.get("roomId");
  const queryDate = searchParams.get("date");
  const queryHour = searchParams.get("hour");

  // Today in Vietnam (UTC+7)
  const defaultDate =
    queryDate || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [numGuests, setNumGuests] = useState(2);
  const [foundMember, setFoundMember] = useState<Member | null>(null);
  const [updatingSocial, setUpdatingSocial] = useState(false);
  const [socialUpdateFeedback, setSocialUpdateFeedback] = useState<string | null>(null);

  // Room selection
  const [roomId, setRoomId] = useState<string>(
    queryRoomId && initialRooms.some((r) => r.id === queryRoomId)
      ? queryRoomId
      : initialRooms[0]?.id || ""
  );

  // Booking Type & Notes
  const [bookingType, setBookingType] = useState<BookingType>("hourly");
  const [closingNote, setClosingNote] = useState("");
  const [note, setNote] = useState("");

  // Hourly specific
  const [hourlyDate, setHourlyDate] = useState(defaultDate);
  const [hourlyCheckinHour, setHourlyCheckinHour] = useState(
    queryHour ? parseInt(queryHour, 10) : 14
  );
  const [hourlyDuration, setHourlyDuration] = useState(3); // 3h combo default

  // Overnight specific
  const [overnightDate, setOvernightDate] = useState(defaultDate);
  const [overnightStartHour, setOvernightStartHour] = useState(
    queryHour && [21, 22, 23, 24].includes(parseInt(queryHour, 10))
      ? parseInt(queryHour, 10)
      : 22
  );
  const [overnightLateHours, setOvernightLateHours] = useState(0);

  // Day use specific
  const [dayuseDate, setDayuseDate] = useState(defaultDate);
  const [dayuseNights, setDayuseNights] = useState(1);
  const [dayuseLateHours, setDayuseLateHours] = useState(0);

  // Custom specific
  const [customCheckinDate, setCustomCheckinDate] = useState(defaultDate);
  const [customCheckinTime, setCustomCheckinTime] = useState("14:00");
  const nextDayStr = useMemo(() => {
    const d = new Date(`${defaultDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, [defaultDate]);
  const [customCheckoutDate, setCustomCheckoutDate] = useState(nextDayStr);
  const [customCheckoutTime, setCustomCheckoutTime] = useState("12:00");
  const [customPrice, setCustomPrice] = useState<number>(0);

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
      outDate.setHours(overnightStartHour + 12 + overnightLateHours, 0, 0, 0);
      return { checkinAt: inDate, checkoutAt: outDate, lateHours: overnightLateHours };
    }

    if (bookingType === "dayuse") {
      const inDate = new Date(`${dayuseDate}T15:00:00`);
      const outDate = new Date(`${dayuseDate}T00:00:00`);
      outDate.setDate(outDate.getDate() + dayuseNights);
      outDate.setHours(12 + dayuseLateHours, 0, 0, 0);
      return { checkinAt: inDate, checkoutAt: outDate, lateHours: dayuseLateHours };
    }

    // Custom
    const inDate = new Date(`${customCheckinDate}T${customCheckinTime}:00`);
    const outDate = new Date(`${customCheckoutDate}T${customCheckoutTime}:00`);
    return { checkinAt: inDate, checkoutAt: outDate, lateHours: 0 };
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
      customPrice: bookingType === "custom" ? customPrice : 0,
    });
  }, [
    bookingType,
    selectedRoom,
    checkinAt,
    checkoutAt,
    lateHours,
    initialPricingRules,
    bookingRules,
    customPrice,
  ]);

  // CDP Auto-fill callback (Phone lookup found returning member)
  const handleMemberFound = (member: Member) => {
    setFoundMember(member);
    const memberName = member.full_name || member.fullName;
    if (memberName) {
      setName(memberName);
    }
    setInstagram(member.instagram || "");
    setFacebook(member.facebook || "");
  };

  const handleMemberNotFound = () => {
    setFoundMember(null);
  };

  // Direct social update for returning guests by phone key
  const handleDirectUpdateSocial = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMsg("Vui lòng nhập số điện thoại khách hàng.");
      return;
    }
    const cleanIg = instagram.trim();
    const cleanFb = facebook.trim();
    if (!cleanIg && !cleanFb) {
      setErrorMsg("Vui lòng nhập tài khoản Instagram hoặc Facebook (bắt buộc có ít nhất 1 trong 2).");
      return;
    }

    setUpdatingSocial(true);
    setSocialUpdateFeedback(null);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/members/${cleanPhone}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagram: cleanIg,
          facebook: cleanFb,
          fullName: name.trim() || undefined,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        const errorText = data.error || "Không thể cập nhật hồ sơ khách hàng.";
        toast.error(errorText, "Lỗi cập nhật mạng xã hội");
        throw new Error(errorText);
      }
      setFoundMember((prev) =>
        prev
          ? {
              ...prev,
              instagram: cleanIg,
              facebook: cleanFb,
              full_name: name.trim() || prev.full_name,
            }
          : null
      );
      const msg = "Đã lưu cập nhật Insta/FB vào hồ sơ khách theo SĐT!";
      setSocialUpdateFeedback(msg);
      toast.success(msg, "Cập nhật CDP");
      setTimeout(() => setSocialUpdateFeedback(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi cập nhật hồ sơ.");
    } finally {
      setUpdatingSocial(false);
    }
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!phone.trim()) {
      const err = "Vui lòng nhập số điện thoại khách hàng.";
      setErrorMsg(err);
      toast.warning(err, "Thiếu thông tin");
      return;
    }
    if (!name.trim()) {
      const err = "Vui lòng nhập họ và tên khách hàng.";
      setErrorMsg(err);
      toast.warning(err, "Thiếu thông tin");
      return;
    }

    // Mandatory: At least 1 of Instagram or Facebook
    const cleanIg = instagram.trim();
    const cleanFb = facebook.trim();
    if (!cleanIg && !cleanFb) {
      const err = "Vui lòng nhập tên tài khoản Instagram hoặc Facebook (bắt buộc phải có ít nhất 1 trong 2).";
      setErrorMsg(err);
      toast.warning(err, "Thiếu tài khoản MXH");
      return;
    }

    if (!roomId) {
      const err = "Vui lòng chọn phòng trống.";
      setErrorMsg(err);
      toast.warning(err, "Chưa chọn phòng");
      return;
    }

    if (bookingType === "custom") {
      if (customPrice <= 0) {
        const err = "Vui lòng nhập số tiền thanh toán cho đơn đặt phòng tuỳ chỉnh.";
        setErrorMsg(err);
        toast.warning(err, "Chưa nhập giá");
        return;
      }
      if (checkoutAt <= checkinAt) {
        const err = "Thời gian trả phòng phải sau thời gian nhận phòng.";
        setErrorMsg(err);
        toast.warning(err, "Lỗi thời gian");
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        roomId,
        phone: phone.trim(),
        name: name.trim(),
        instagram: cleanIg,
        facebook: cleanFb,
        numGuests,
        bookingType,
        checkinAt: checkinAt.toISOString(),
        checkoutAt: checkoutAt.toISOString(),
        lateCheckoutHours: lateHours,
        customPrice: bookingType === "custom" ? customPrice : undefined,
        closingNote: closingNote.trim(),
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
        const errorText = data.error || "Không thể tạo đặt phòng.";
        if (res.status === 409) {
          toast.warning(errorText, "Xung đột lịch & Giờ dọn phòng");
        } else {
          toast.error(errorText, "Lỗi tạo đặt phòng");
        }
        throw new Error(errorText);
      }

      const successNotice = `Đã tạo thành công mã đặt phòng #${data.booking.id} cho ${name}!`;
      setSuccessMsg(`✅ ${successNotice} Đang chuyển hướng...`);
      toast.success(successNotice, "Tạo đơn thành công");

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

      {/* 1. Customer Information Card */}
      <div className="rounded-2xl bg-[#0d131f] border border-slate-800 p-5 space-y-4 shadow-lg">
        <div className="border-b border-slate-800/80 pb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <span>👤</span> Thông tin khách hàng (Tích hợp Mini CDP)
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">
            Tự động nhớ hồ sơ khách quen
          </span>
        </div>

        {/* Row 1: Phone + Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PhoneLookupField
            phone={phone}
            onChangePhone={(p) => {
              setPhone(p);
              if (foundMember && p.trim() !== foundMember.phone) {
                setFoundMember(null);
                setSocialUpdateFeedback(null);
              }
            }}
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

        {/* Row 2: Instagram + Facebook (Mandatory 1 in 2) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <span>📱</span> Tài khoản Mạng Xã Hội
              <span className="text-rose-400 font-bold text-sm">*</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Bắt buộc có ít nhất 1 trong 2
              </span>
              {foundMember && (
                <button
                  type="button"
                  onClick={handleDirectUpdateSocial}
                  disabled={updatingSocial || (!instagram.trim() && !facebook.trim())}
                  className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1 active:scale-95 disabled:opacity-40"
                  title="Lưu cập nhật Insta/FB vào hồ sơ khách quen theo SĐT ngay lập tức"
                >
                  {updatingSocial ? "⏳ Đang lưu..." : "💾 Cập nhật hồ sơ khách"}
                </button>
              )}
            </div>
          </div>

          {socialUpdateFeedback && (
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-1.5 animate-in fade-in duration-200">
              <span>✅</span>
              <span>{socialUpdateFeedback}</span>
            </div>
          )}

          {foundMember && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-950/40 p-2 rounded-lg border border-slate-800/80">
              <span>ℹ️</span>
              <span>
                Khách quen: Bạn có thể thay đổi Insta/FB bên dưới. Hệ thống sẽ cập nhật theo SĐT khi tạo đơn hoặc bấm &quot;Cập nhật hồ sơ khách&quot;.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tài khoản Instagram
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">
                  @
                </span>
                <input
                  type="text"
                  placeholder="everyinn.hotel"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))}
                  className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 pl-7 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tài khoản Facebook
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-blue-400">
                  f
                </span>
                <input
                  type="text"
                  placeholder="Tên Facebook hoặc link"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 pl-7 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Number of Guests */}
        <div className="pt-1">
          <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase mb-1.5">
            Số lượng khách
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setNumGuests(Math.max(1, numGuests - 1))}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base flex items-center justify-center border border-slate-700 transition-colors cursor-pointer"
            >
              −
            </button>
            <span className="font-mono font-bold text-base text-white px-2">
              {numGuests} người
            </span>
            <button
              type="button"
              onClick={() => setNumGuests(Math.min(4, numGuests + 1))}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base flex items-center justify-center border border-slate-700 transition-colors cursor-pointer"
            >
              +
            </button>
            <span className="text-xs text-slate-400 pl-2">
              (Tiêu chuẩn 2 người / phòng)
            </span>
          </div>
        </div>
      </div>

      {/* 2. Booking Type & Time Specs (With Room Selection At Bottom) */}
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

        {/* Relocated: Room Selection At Bottom of Booking Type Card */}
        <div className="pt-3 border-t border-slate-800">
          <label className="block text-xs font-bold text-slate-200 tracking-wide uppercase mb-1.5 flex items-center gap-1.5">
            <span>🚪</span>
            <span>Chọn phòng trống</span>
            <span className="text-rose-400">*</span>
          </label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer shadow-inner"
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

        {/* Closing / Confirmation Note with Guest */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase mb-1">
            Câu chốt với khách (Thoả thuận đặt phòng)
          </label>
          <textarea
            rows={2}
            value={closingNote}
            onChange={(e) => setClosingNote(e.target.value)}
            placeholder="VD: Dạ vậy bên Home xin chốt là bên mình book 201 in 21H 23/9 out 9H 24/9 tổng là 392K ạ..."
            className="w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-sans"
          />
        </div>

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

      {/* 3. Price Summary Card */}
      <PriceSummaryCard pricing={pricing} selectedRoom={selectedRoom} />

      {/* 4. Action Buttons */}
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
