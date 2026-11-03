"use client";

import React, { useMemo, useState } from "react";
import type {
  LoyaltyTier,
  Member,
  PricingRule,
  Room,
  SurchargeRule,
} from "@/types";
import type { Promotion } from "@/types/promotions";
import type { CoreHoldDto } from "@/lib/coreMappers";
import { calculatePrice } from "@/lib/pricing";
import { PhoneLookupField } from "../PhoneLookupField";
import { PromotionSelector } from "../PromotionSelector";
import { DepositSection } from "../DepositSection";
import { PriceSummaryCard } from "../PriceSummaryCard";
import { Input } from "../../ui/Input";

interface HoldBookingFormStepProps {
  hold: CoreHoldDto;
  room: Room;
  pricingRules: PricingRule[];
  surchargeRules: SurchargeRule[];
  releasing: boolean;
  onExitAndReselect: () => void;
  onDraftSavedAndProceed: (updatedHold: CoreHoldDto) => void;
}

const BOOKING_TYPE_BADGE: Record<string, string> = {
  hourly: "⏱️ Theo Giờ",
  overnight: "🌙 Qua Đêm",
  dayuse: "☀️ Theo Ngày",
  custom: "✨ Tuỳ Chỉnh",
};

function formatDateTimeVn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const HoldBookingFormStep: React.FC<HoldBookingFormStepProps> = ({
  hold,
  room,
  pricingRules,
  surchargeRules,
  releasing,
  onExitAndReselect,
  onDraftSavedAndProceed,
}) => {
  const existingDraft = hold.checkoutDraft;

  const [phone, setPhone] = useState<string>(existingDraft?.guest.phoneRaw || "");
  const [name, setName] = useState<string>(existingDraft?.guest.name || "");
  const [instagram, setInstagram] = useState<string>(existingDraft?.guest.instagram || "");
  const [facebook, setFacebook] = useState<string>(existingDraft?.guest.facebook || "");
  const [zalo, setZalo] = useState<string>(existingDraft?.guest.zalo || "");
  const [foundMember, setFoundMember] = useState<Member | null>(null);

  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(
    existingDraft?.promotionDiscount || 0
  );

  const [isDeposit, setIsDeposit] = useState<boolean>(existingDraft?.isDeposit || false);
  const [depositAmount, setDepositAmount] = useState<number>(
    existingDraft?.depositAmount || 0
  );
  const [depositDueDate, setDepositDueDate] = useState<string>(
    existingDraft?.depositDueDate || hold.checkinAt.slice(0, 10)
  );

  const [closingNote, setClosingNote] = useState<string>(existingDraft?.closingNote || "");
  const [note, setNote] = useState<string>(existingDraft?.note || "");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const checkinDateObj = useMemo(() => new Date(hold.checkinAt), [hold.checkinAt]);
  const checkoutDateObj = useMemo(() => new Date(hold.checkoutAt), [hold.checkoutAt]);
  const checkinDateStr = useMemo(() => {
    const vnMs = checkinDateObj.getTime() + 7 * 3600 * 1000;
    return new Date(vnMs).toISOString().slice(0, 10);
  }, [checkinDateObj]);

  // Calculate live 4-part bill breakdown using the same pricing engine as /bookings/new
  const rawPricing = useMemo(() => {
    try {
      return calculatePrice({
        bookingType: hold.bookingType,
        roomClass: room.room_class,
        checkinAt: checkinDateObj,
        checkoutAt: checkoutDateObj,
        earlyCheckinHours: hold.earlyCheckinHours,
        lateCheckoutHours: hold.lateCheckoutHours,
        numGuests: hold.numGuests,
        pricingRules,
        surchargeRules,
        discountAmount: 0,
      });
    } catch {
      return null;
    }
  }, [
    hold.bookingType,
    hold.earlyCheckinHours,
    hold.lateCheckoutHours,
    hold.numGuests,
    room.room_class,
    checkinDateObj,
    checkoutDateObj,
    pricingRules,
    surchargeRules,
  ]);

  const finalPricing = useMemo(() => {
    try {
      return calculatePrice({
        bookingType: hold.bookingType,
        roomClass: room.room_class,
        checkinAt: checkinDateObj,
        checkoutAt: checkoutDateObj,
        earlyCheckinHours: hold.earlyCheckinHours,
        lateCheckoutHours: hold.lateCheckoutHours,
        numGuests: hold.numGuests,
        pricingRules,
        surchargeRules,
        discountAmount,
      });
    } catch {
      return null;
    }
  }, [
    hold.bookingType,
    hold.earlyCheckinHours,
    hold.lateCheckoutHours,
    hold.numGuests,
    room.room_class,
    checkinDateObj,
    checkoutDateObj,
    pricingRules,
    surchargeRules,
    discountAmount,
  ]);

  const effectiveTotalPrice = finalPricing?.totalPrice ?? hold.quotedTotalPrice;
  const remainingAmount = isDeposit
    ? Math.max(0, effectiveTotalPrice - depositAmount)
    : 0;

  const memberTier: LoyaltyTier =
    (foundMember?.loyalty_tier as LoyaltyTier) ||
    (foundMember?.loyaltyTier as LoyaltyTier) ||
    "new";

  const handleGenerateClosingNote = () => {
    const channel = instagram
      ? `IG (${instagram})`
      : facebook
      ? `FB (${facebook})`
      : zalo
      ? `Zalo (${zalo})`
      : "Kênh trực tiếp";
    const payText = isDeposit
      ? `cọc ${depositAmount.toLocaleString("vi-VN")}đ (còn ${remainingAmount.toLocaleString("vi-VN")}đ)`
      : `thanh toán đủ ${effectiveTotalPrice.toLocaleString("vi-VN")}đ`;
    const generated = `Khách ${name || phone || "..."} chốt ${room.name} (${hold.numGuests} khách) qua ${channel}: Nhận ${formatDateTimeVn(hold.checkinAt)} → Trả ${formatDateTimeVn(hold.checkoutAt)}, ${payText}.`;
    setClosingNote(generated);
  };

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!phone.trim() || !name.trim()) {
      setErrorMsg("Vui lòng nhập đầy đủ Số điện thoại và Họ tên khách hàng.");
      return;
    }
    if (!instagram.trim() && !facebook.trim() && !zalo.trim()) {
      setErrorMsg(
        "Vui lòng nhập ít nhất 1 trong 3 tài khoản mạng xã hội (Instagram, Facebook hoặc Zalo)."
      );
      return;
    }
    if (closingNote.trim().length < 3) {
      setErrorMsg("Vui lòng nhập 'Câu chốt với khách' (tối thiểu 3 ký tự).");
      return;
    }
    if (isDeposit && (depositAmount <= 0 || depositAmount > effectiveTotalPrice)) {
      setErrorMsg("Số tiền đặt cọc không hợp lệ.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/holds/${encodeURIComponent(hold.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          name: name.trim(),
          instagram: instagram.trim(),
          facebook: facebook.trim(),
          zalo: zalo.trim(),
          closingNote: closingNote.trim(),
          note: note.trim() || undefined,
          promotionId: selectedPromotion?.id || undefined,
          promotionCode: selectedPromotion?.code || undefined,
          isDeposit,
          depositAmount: isDeposit ? depositAmount : 0,
          depositDueDate: isDeposit ? depositDueDate : undefined,
          paymentMethod: "bank_transfer",
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        setErrorMsg(data.error || "Không thể lưu thông tin đặt phòng. Vui lòng kiểm tra lại.");
        return;
      }

      onDraftSavedAndProceed(data.hold);
    } catch (err) {
      console.error("Failed to save hold draft:", err);
      setErrorMsg("Lỗi kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleProceedToPayment} className="space-y-6">
      {/* Locked Room & Stay Summary Card */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider">
              Phòng đang giữ chỗ
            </span>
            <span className="text-xs font-bold text-slate-300">
              {BOOKING_TYPE_BADGE[hold.bookingType] || hold.bookingType} • {hold.numGuests} khách
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
            {room.name} ({room.room_class.toUpperCase()})
          </h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-mono">
            <span>📥 Nhận: {formatDateTimeVn(hold.checkinAt)}</span>
            <span>📤 Trả: {formatDateTimeVn(hold.checkoutAt)}</span>
          </div>
        </div>

        <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
            Giá niêm yết tạm tính
          </span>
          <span className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400">
            {effectiveTotalPrice.toLocaleString("vi-VN")} đ
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-bold flex items-center gap-2.5">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Guest Info, Socials, Promotions, Deposit, Notes */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Guest & Mini CDP Lookup */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2.5">
              1. Thông Tin Khách Hàng (Mini CDP)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhoneLookupField
                phone={phone}
                onChangePhone={setPhone}
                onMemberFound={(member) => {
                  setFoundMember(member);
                  const memberName = member.full_name || member.fullName;
                  if (memberName) setName(memberName);
                  if (member.instagram) setInstagram(member.instagram);
                  if (member.facebook) setFacebook(member.facebook);
                  if (member.zalo) setZalo(member.zalo);
                }}
                onMemberNotFound={() => setFoundMember(null)}
              />

              <Input
                label="Họ và tên khách hàng"
                required
                placeholder="Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Social Account (Mandatory 1 of 3) */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Tài khoản MXH liên hệ <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Bắt buộc điền ít nhất 1 trong 3 kênh (IG / FB / Zalo)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Instagram"
                  placeholder="@username..."
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
                <Input
                  label="Facebook"
                  placeholder="Tên / Link FB..."
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                />
                <Input
                  label="Zalo"
                  placeholder="SĐT / Tên Zalo..."
                  value={zalo}
                  onChange={(e) => setZalo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 2. Promotion Selector */}
          <PromotionSelector
            roomClass={room.room_class}
            bookingType={hold.bookingType}
            checkinAt={checkinDateObj}
            checkoutAt={checkoutDateObj}
            basePrice={rawPricing?.basePrice ?? hold.quotedBasePrice}
            rawSubtotal={rawPricing?.totalPrice ?? hold.quotedTotalPrice}
            hasHolidaySurcharge={(rawPricing?.holidaySurcharge ?? 0) > 0}
            memberTier={memberTier}
            selectedPromotion={selectedPromotion}
            onSelectPromotion={(promo, discount) => {
              setSelectedPromotion(promo);
              setDiscountAmount(discount);
            }}
          />

          {/* 3. Deposit vs Full Payment */}
          <DepositSection
            isDeposit={isDeposit}
            onToggleDeposit={setIsDeposit}
            depositAmount={depositAmount}
            onChangeDepositAmount={setDepositAmount}
            depositDueDate={depositDueDate}
            onChangeDepositDueDate={setDepositDueDate}
            totalPrice={effectiveTotalPrice}
            checkinDateStr={checkinDateStr}
          />

          {/* 4. Closing Note & Internal Note */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Câu chốt với khách <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateClosingNote}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition-colors cursor-pointer"
              >
                ⚡ Tạo nhanh mẫu câu chốt
              </button>
            </div>

            <textarea
              rows={2}
              required
              value={closingNote}
              onChange={(e) => setClosingNote(e.target.value)}
              placeholder="VD: Đã chốt khách qua IG nhận phòng 22h trả 10h, khách chuyển khoản đủ..."
              className="w-full rounded-xl bg-slate-50/70 border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-2xs"
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Ghi chú vận hành nội bộ (Tuỳ chọn)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Khách xin thêm 1 gối, chuẩn bị trang trí sinh nhật..."
                className="w-full rounded-xl bg-slate-50/70 border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Sticky 4-Part Bill Summary & Action Buttons */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          {finalPricing && (
            <PriceSummaryCard
              pricing={finalPricing}
              selectedRoom={room}
              numGuests={hold.numGuests}
              promotionName={selectedPromotion?.name}
              isDeposit={isDeposit}
              depositAmount={depositAmount}
              remainingAmount={remainingAmount}
              depositDueDate={depositDueDate}
              guestInfo={{
                name,
                phone,
                instagram,
                facebook,
                zalo,
                memberTier: (foundMember?.loyalty_tier as any) || (foundMember?.loyaltyTier as any),
              }}
              stayDetails={{
                bookingType: hold.bookingType,
                checkinAt: new Date(hold.checkinAt),
                checkoutAt: new Date(hold.checkoutAt),
                closingNote,
              }}
            />
          )}

          <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs space-y-2.5">
            <button
              type="submit"
              disabled={submitting || releasing}
              className="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              {submitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Đang lưu & chuyển sang Thanh toán...</span>
                </>
              ) : (
                <>
                  <span>💳</span>
                  <span>Tiến Tới Bước Thanh Toán ➔</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onExitAndReselect}
              disabled={submitting || releasing}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span>🚪</span>
              <span>Thoát & Chọn lại phòng từ đầu</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
