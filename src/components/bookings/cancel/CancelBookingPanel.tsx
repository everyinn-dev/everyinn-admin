"use client";

import React, { useMemo, useState } from "react";
import type { ClosureReasonCode, GanttBookingItem } from "@/types";
import { CLOSURE_REASONS, netReceivedOf, REFUND_METHODS, type BffError, type RefundMethod } from "@/lib/bookingClosure";
import { BookingCommandPanel } from "@/components/bookings/shared/BookingCommandPanel";
import { MoneySummary } from "@/components/bookings/shared/MoneySummary";
import { ReasonField } from "@/components/bookings/shared/ReasonField";
import { useBookingCommand } from "@/components/bookings/shared/useBookingCommand";

type RefundChoice = "none" | "full" | "partial";

interface CancelBookingPanelProps {
  booking: GanttBookingItem;
  onClosed: (result: { booking: Record<string, unknown>; message: string }) => void;
  /** Called with the BFF error when Core rejects the command (the drawer decides: reload vs show message). */
  onError: (status: number, data: BffError) => Promise<void> | void;
  onDismiss: () => void;
  /** Open with this reason already chosen (e.g. "Huỷ & tạo lại" from the edit form). */
  initialReason?: ClosureReasonCode;
}

const vnd = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString("vi-VN")}đ`;

/**
 * "Huỷ đặt phòng" — one flow for every way a booking ends early (No-show included).
 * Step 1: why (reason code). Step 2: money (refund 0…received, the rest is retained). Step 3: confirm.
 * Built on the same pieces as the charge panel (frame, command hook, reason field, money block).
 */
export const CancelBookingPanel: React.FC<CancelBookingPanelProps> = ({ booking, onClosed, onError, onDismiss, initialReason }) => {
  const received = netReceivedOf(booking);
  const isPending = booking.status === "pending";
  // From the check-in time until checkout the guest may already be in the room.
  const inHouse = Date.now() >= Date.parse(booking.checkinAt);
  const initial = CLOSURE_REASONS.find((r) => r.code === initialReason && !(r.code === "no_show" && isPending)) ?? null;

  const [reasonCode, setReasonCode] = useState<ClosureReasonCode | null>(initial?.code ?? null);
  const [note, setNote] = useState("");
  const [refundChoice, setRefundChoice] = useState<RefundChoice>(received > 0 && initial?.defaultRefund === "full" ? "full" : "none");
  const [partialAmount, setPartialAmount] = useState(received);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [refundReference, setRefundReference] = useState("");
  const { run, submitting, error } = useBookingCommand({ onError });

  const reason = CLOSURE_REASONS.find((r) => r.code === reasonCode) ?? null;
  const refundAmount = refundChoice === "full" ? received : refundChoice === "partial" ? Math.min(received, Math.max(0, partialAmount)) : 0;
  const retained = received - refundAmount;

  const blockedReason = useMemo(() => {
    if (!reason) return "Vui lòng chọn lý do huỷ.";
    if (reason.code === "no_show" && isPending) return "Đơn chưa xác nhận không thể ghi nhận No-show.";
    if (reason.noteRequired && !note.trim()) return "Vui lòng nhập lý do cụ thể.";
    if (refundChoice === "partial" && (partialAmount <= 0 || partialAmount > received)) return `Số tiền hoàn phải từ 1đ đến ${vnd(received)}.`;
    return "";
  }, [reason, isPending, note, refundChoice, partialAmount, received]);

  const pickReason = (code: ClosureReasonCode) => {
    const r = CLOSURE_REASONS.find((x) => x.code === code)!;
    setReasonCode(code);
    if (received <= 0) {
      setRefundChoice("none");
      return;
    }
    setRefundChoice(r.defaultRefund);
    if (r.defaultRefund === "full") setPartialAmount(received);
  };

  const submit = async () => {
    if (blockedReason || !reason) return;
    const data = await run<{ booking?: Record<string, unknown>; message?: string }>(
      `/api/bookings/${booking.id}`,
      {
        action: "cancel",
        reasonCode: reason.code,
        reason: note.trim() || undefined,
        refundAmount,
        refundMethod: refundAmount > 0 ? refundMethod : undefined,
        refundReference: refundAmount > 0 && refundReference.trim() ? refundReference.trim() : undefined,
        expectedVersion: booking.version ?? booking.modNo,
      },
      "PATCH",
    );
    if (data) onClosed({ booking: data.booking ?? {}, message: data.message || "Đã huỷ đặt phòng." });
  };

  return (
    <BookingCommandPanel
      tone="rose"
      title={`Huỷ đặt phòng #${booking.id}`}
      intro={
        <>
          Đơn vẫn được lưu lại với trạng thái <strong>Đã huỷ</strong> (hoặc <strong>No-show</strong>) và phòng được giải phóng trên Bảng phòng. Hồ sơ thành viên và điểm tích luỹ không thay đổi.
        </>
      }
      submitting={submitting}
      error={error}
      blockedReason={reasonCode ? blockedReason : undefined}
      confirmLabel={reason?.code === "no_show" ? "Xác nhận No-show" : "Xác nhận huỷ"}
      onConfirm={submit}
      onDismiss={onDismiss}
    >
      {inHouse && (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
          ⚠️ Đã qua giờ nhận phòng — khách có thể đang ở. Chỉ huỷ khi chắc chắn; tiền đã thu phải được hoàn hoặc giữ lại rõ ràng ở bước 2.
        </p>
      )}

      {/* 1. Reason */}
      <fieldset className="space-y-1.5 bg-white p-3 rounded-xl border border-rose-200 shadow-xs">
        <legend className="text-[11px] font-bold text-slate-700 px-1">1. Lý do huỷ</legend>
        {CLOSURE_REASONS.map((r) => {
          const disabled = r.code === "no_show" && isPending;
          return (
            <label key={r.code} className={`flex items-start gap-2 text-xs ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <input type="radio" name="closureReason" className="mt-0.5 accent-rose-600" disabled={disabled} checked={reasonCode === r.code} onChange={() => pickReason(r.code)} />
              <span>
                <span className="font-semibold text-slate-800">{r.label}</span>
                <span className="block text-[11px] text-slate-500">{disabled ? "Chỉ áp dụng cho đơn đã xác nhận." : r.hint}</span>
              </span>
            </label>
          );
        })}
        <ReasonField label={reason?.noteRequired ? "Ghi rõ lý do" : "Ghi chú thêm (tuỳ chọn)"} required={reason?.noteRequired} value={note} onChange={setNote} />
      </fieldset>

      {/* 2. Money */}
      <fieldset className="space-y-2 bg-white p-3 rounded-xl border border-rose-200 shadow-xs">
        <legend className="text-[11px] font-bold text-slate-700 px-1">2. Tiền của đơn</legend>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-500 block">Tổng giá trị đơn</span>
            <span className="font-mono font-bold text-slate-800">{vnd(booking.totalPrice)}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block">Khách đã trả (thực nhận)</span>
            <span className="font-mono font-bold text-slate-800">{vnd(received)}</span>
          </div>
        </div>

        {received <= 0 ? (
          <p className="text-[11px] text-slate-500 italic">Chưa thu tiền của đơn này — không có gì để hoàn.</p>
        ) : (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            {([
              ["none", `Không hoàn (giữ lại ${vnd(received)})`],
              ["full", `Hoàn toàn bộ ${vnd(received)}`],
              ["partial", "Hoàn một phần"],
            ] as const).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="refundChoice"
                  className="accent-rose-600"
                  checked={refundChoice === value}
                  onChange={() => {
                    setRefundChoice(value);
                    if (value === "partial") setPartialAmount(Math.round(received * 0.5));
                  }}
                />
                <span>{label}</span>
              </label>
            ))}

            {refundChoice === "partial" && (
              <div className="space-y-1.5 pl-5">
                <div className="flex items-center gap-1.5">
                  {[0.3, 0.5].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPartialAmount(Math.round(received * pct))}
                      className="px-2 py-0.5 rounded-lg text-[11px] bg-slate-100 hover:bg-slate-200 text-rose-800 font-bold border border-slate-200 cursor-pointer"
                    >
                      Hoàn {pct * 100}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={received}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-xs font-mono font-bold text-amber-700 focus:outline-none focus:border-rose-600"
                  aria-label="Số tiền hoàn"
                />
              </div>
            )}

            {refundAmount > 0 && (
              <div className="grid grid-cols-2 gap-2 pl-5">
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                  className="px-2 py-1.5 rounded-xl bg-white border border-rose-300 text-xs text-slate-800"
                  aria-label="Phương thức hoàn"
                >
                  {REFUND_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Mã giao dịch (tuỳ chọn)"
                  value={refundReference}
                  onChange={(e) => setRefundReference(e.target.value)}
                  className="px-2 py-1.5 rounded-xl bg-white border border-rose-300 text-xs text-slate-800 placeholder-slate-400"
                />
              </div>
            )}

            <MoneySummary
              rows={[
                { label: "Hoàn cho khách", value: refundAmount, tone: "bad" },
                { label: "Khách sạn giữ lại", value: retained, tone: "good", strong: true },
              ]}
            />
          </div>
        )}
      </fieldset>
    </BookingCommandPanel>
  );
};
