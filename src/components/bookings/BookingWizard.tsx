"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PricingRule, Room, SurchargeRule } from "@/types";
import type { CoreHoldDto } from "@/lib/coreMappers";
import { HoldCountdownBanner } from "./HoldCountdownBanner";
import { RoomSearchStep, type SearchStayCriteria } from "./search/RoomSearchStep";
import type { AvailableRoomCardItem } from "./search/AvailableRoomCard";
import { HoldBookingFormStep } from "./checkout/HoldBookingFormStep";
import { MockPaymentStep } from "./checkout/MockPaymentStep";
import { useToast } from "../ui/Toast";
import { notifyDataChanged } from "@/lib/syncEvents";

type WizardStep = "search" | "fill_info" | "payment" | "completed";

const SESSION_HOLD_KEY = "ei_active_hold_id_v1";

interface BookingWizardProps {
  rooms: Room[];
  pricingRules: PricingRule[];
  surchargeRules: SurchargeRule[];
  hourlySlots?: number[];
}

export const BookingWizard: React.FC<BookingWizardProps> = ({
  rooms,
  pricingRules,
  surchargeRules,
  hourlySlots,
}) => {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<WizardStep>("search");
  const [activeHold, setActiveHold] = useState<CoreHoldDto | null>(null);
  const [holdingRoomId, setHoldingRoomId] = useState<string | null>(null);
  const [releasingHold, setReleasingHold] = useState<boolean>(false);
  const [completedResult, setCompletedResult] = useState<{
    booking: any;
    telegramSent: boolean;
    telegramReason: string | null;
  } | null>(null);

  const expiredHandledRef = useRef<string | null>(null);

  // Restore active hold on page reload if still within the 15-minute window
  useEffect(() => {
    let ignore = false;
    async function restoreSessionHold() {
      try {
        const savedHoldId = sessionStorage.getItem(SESSION_HOLD_KEY);
        if (!savedHoldId) return;

        const res = await fetch(`/api/holds/${encodeURIComponent(savedHoldId)}`);
        if (!res.ok) {
          sessionStorage.removeItem(SESSION_HOLD_KEY);
          return;
        }
        const data = (await res.json()) as { hold?: CoreHoldDto };
        const hold = data.hold;
        if (!hold || ignore) return;

        if (
          (hold.status === "active" || hold.status === "awaiting_payment") &&
          hold.remainingSeconds > 0
        ) {
          setActiveHold(hold);
          setStep(hold.status === "awaiting_payment" ? "payment" : "fill_info");
        } else {
          sessionStorage.removeItem(SESSION_HOLD_KEY);
        }
      } catch {
        // Ignore session restore errors
      }
    }

    restoreSessionHold();
    return () => {
      ignore = true;
    };
  }, []);

  const selectedRoomObj: Room | null = useMemo(() => {
    if (!activeHold) return null;
    return (
      rooms.find((r) => r.id === activeHold.roomId) || {
        id: activeHold.roomId,
        property_id: activeHold.propertyId,
        room_number: activeHold.roomNumber || activeHold.roomId,
        name: activeHold.roomName || activeHold.roomId,
        room_class: activeHold.roomClass,
        floor: 1,
        max_guests: activeHold.roomClass === "signature" ? 4 : 2,
        sort_order: 1,
        is_active: 1,
        created_at: "",
        updated_at: "",
      }
    );
  }, [activeHold, rooms]);

  // Step 1 -> Step 2: Select room & create 15-minute hold
  const handleSelectRoomAndHold = async (
    item: AvailableRoomCardItem,
    criteria: SearchStayCriteria
  ) => {
    setHoldingRoomId(item.room.id);
    try {
      const res = await fetch("/api/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: item.room.id,
          bookingType: criteria.bookingType,
          checkinAt: criteria.checkinAt.toISOString(),
          checkoutAt: criteria.checkoutAt.toISOString(),
          earlyCheckinHours: criteria.earlyCheckinHours,
          lateCheckoutHours: criteria.lateCheckoutHours,
          numGuests: criteria.numGuests,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok || !data.hold) {
        toast.error(
          data.error || "Phòng vừa được người khác giữ hoặc đặt. Vui lòng chọn phòng khác."
        );
        return;
      }

      const hold: CoreHoldDto = data.hold;
      expiredHandledRef.current = null;
      setActiveHold(hold);
      setStep("fill_info");
      try {
        sessionStorage.setItem(SESSION_HOLD_KEY, hold.id);
      } catch {}
      toast.success(`Đã khóa giữ ${item.room.name} trong 15 phút!`);
    } catch (err) {
      console.error("Create hold error:", err);
      toast.error("Không thể tạo phiên giữ phòng. Vui lòng thử lại.");
    } finally {
      setHoldingRoomId(null);
    }
  };

  // Release hold & return to Step 1 ("Thoát & Chọn lại")
  const handleExitAndReselect = useCallback(async () => {
    if (!activeHold) {
      setStep("search");
      return;
    }

    setReleasingHold(true);
    const holdId = activeHold.id;
    try {
      await fetch(`/api/holds/${encodeURIComponent(holdId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Lễ tân bấm Thoát & Chọn lại" }),
      });
    } catch (err) {
      console.warn("Release hold warning:", err);
    } finally {
      try {
        sessionStorage.removeItem(SESSION_HOLD_KEY);
      } catch {}
      setActiveHold(null);
      setReleasingHold(false);
      setStep("search");
      toast.info("Đã hủy giữ phòng và đơn tạm. Bạn có thể tìm và chọn lại phòng mới.");
    }
  }, [activeHold, toast]);

  // Auto-expire when 15-minute timer reaches 00:00
  const handleHoldExpired = useCallback(async () => {
    if (!activeHold) return;
    if (expiredHandledRef.current === activeHold.id) return;
    expiredHandledRef.current = activeHold.id;

    const holdId = activeHold.id;
    try {
      await fetch(`/api/holds/${encodeURIComponent(holdId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Hết hạn 15 phút giữ phòng" }),
      });
    } catch {}
    try {
      sessionStorage.removeItem(SESSION_HOLD_KEY);
    } catch {}
    setActiveHold(null);
    setStep("search");
    toast.warning(
      "Đã hết 15 phút giữ phòng! Đơn tạm đã tự động hủy, vui lòng tìm và chọn lại phòng."
    );
  }, [activeHold, toast]);

  // Step 3 -> Completed: Mock payment confirmed
  const handlePaymentConfirmed = (result: {
    booking: any;
    telegramSent: boolean;
    telegramReason: string | null;
  }) => {
    try {
      sessionStorage.removeItem(SESSION_HOLD_KEY);
    } catch {}
    setActiveHold(null);
    setCompletedResult(result);
    setStep("completed");
    notifyDataChanged("BOOKINGS_CHANGED");
    toast.success(`Đặt phòng #${result.booking.id} thành công!`);
  };

  const stepMeta = [
    { key: "search", number: 1, label: "Tìm Phòng Trống & Báo Giá" },
    { key: "fill_info", number: 2, label: "Nhập Thông Tin Khách (Giữ 15p)" },
    { key: "payment", number: 3, label: "Thanh Toán & Hoàn Tất" },
  ] as const;

  const currentStepNumber =
    step === "search" ? 1 : step === "fill_info" ? 2 : step === "payment" ? 3 : 4;

  return (
    <div className="space-y-6">
      {/* Stepper Progress Header */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3.5 sm:px-6 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {stepMeta.map((s) => {
            const isCurrent = currentStepNumber === s.number;
            const isDone = currentStepNumber > s.number;
            return (
              <div
                key={s.key}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs transition-all ${
                  isCurrent
                    ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-extrabold shadow-2xs"
                    : isDone
                    ? "bg-slate-50 border-emerald-200 text-emerald-800 font-bold"
                    : "bg-slate-50/50 border-slate-200/70 text-slate-400 font-medium"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                    isCurrent
                      ? "bg-emerald-600 text-white"
                      : isDone
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isDone ? "✓" : s.number}
                </span>
                <span className="truncate">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Persistent 15-Minute Countdown Banner across Step 2 & Step 3 */}
      {activeHold && (step === "fill_info" || step === "payment") && (
        <HoldCountdownBanner
          holdId={activeHold.id}
          roomName={selectedRoomObj?.name || activeHold.roomId}
          expiresAt={activeHold.expiresAt}
          stepLabel={
            step === "fill_info"
              ? "Bước 2/3: Đang chờ nhập thông tin khách hàng"
              : "Bước 3/3: Đang chờ xác nhận thanh toán"
          }
          releasing={releasingHold}
          onExitAndReselect={handleExitAndReselect}
          onExpired={handleHoldExpired}
        />
      )}

      {/* STEP 1: Room Search */}
      {step === "search" && (
        <RoomSearchStep
          hourlySlots={hourlySlots}
          holdingRoomId={holdingRoomId}
          onSelectRoomAndHold={handleSelectRoomAndHold}
        />
      )}

      {/* STEP 2: Fill Guest Info while Room is Held */}
      {step === "fill_info" && activeHold && selectedRoomObj && (
        <HoldBookingFormStep
          hold={activeHold}
          room={selectedRoomObj}
          pricingRules={pricingRules}
          surchargeRules={surchargeRules}
          releasing={releasingHold}
          onExitAndReselect={handleExitAndReselect}
          onDraftSavedAndProceed={(updatedHold) => {
            setActiveHold(updatedHold);
            setStep("payment");
          }}
        />
      )}

      {/* STEP 3: Mock Payment Screen */}
      {step === "payment" && activeHold && selectedRoomObj && (
        <MockPaymentStep
          hold={activeHold}
          room={selectedRoomObj}
          releasing={releasingHold}
          onBackToEditInfo={() => setStep("fill_info")}
          onExitAndReselect={handleExitAndReselect}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}

      {/* COMPLETED SCREEN */}
      {step === "completed" && completedResult && (
        <div className="max-w-2xl mx-auto rounded-3xl bg-white border border-emerald-200 shadow-sm p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center text-3xl mx-auto shadow-xs">
            🎉
          </div>

          <div className="space-y-1.5">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase tracking-wider">
              Đã Thanh Toán & Lưu Đơn Thành Công
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Mã đặt phòng: #{completedResult.booking.id}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Phòng <strong>{completedResult.booking.roomName || completedResult.booking.roomId}</strong>{" "}
              • Khách hàng: <strong>{completedResult.booking.name}</strong> ({completedResult.booking.phone})
            </p>
          </div>

          {/* Telegram Notification Status Badge */}
          <div
            className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 ${
              completedResult.telegramSent
                ? "bg-sky-50 border-sky-200 text-sky-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <span>✈️</span>
            {completedResult.telegramSent ? (
              <span>Đã tự động gửi tin nhắn thông báo Telegram cho Chủ nhà!</span>
            ) : (
              <span>
                Đơn đã lưu thành công. (Thông báo Telegram đang chờ cấu hình{" "}
                <code className="font-mono">TELEGRAM_BOT_TOKEN</code> &{" "}
                <code className="font-mono">TELEGRAM_CHAT_ID</code>)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCompletedResult(null);
                setStep("search");
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-all cursor-pointer"
            >
              🔍 Tìm & Đặt phòng tiếp theo
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
            >
              📋 Về Bảng Phòng (Gantt)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

