"use client";

import React, { useMemo, useState } from "react";
import type { ClosureReasonCode, GanttBookingItem } from "@/types";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/apiClient";
import { CLOSURE_REASONS, netReceivedOf, REFUND_METHODS, type BffError, type RefundMethod } from "@/lib/bookingClosure";

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
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  // One key per opening of the panel: a double click or a network retry replays the same command in Core.
  const [idempotencyKey] = useState(() => `adm.booking-close.${crypto.randomUUID()}`);

  const reason = CLOSURE_REASONS.find((r) => r.code === reasonCode) ?? null;
  const refundAmount = refundChoice === "full" ? received : refundChoice === "partial" ? Math.min(received, Math.max(0, partialAmount)) : 0;
  const retained = received - refundAmount;

  const validation = useMemo(() => {
    if (!reason) return "Vui lòng chọn lý do huỷ.";
    if (reason.code === "no_show" && isPending) return "Đơn chưa xác nhận không thể ghi nhận No-show.";
    if (reason.noteRequired && !note.trim()) return "Vui lòng nhập lý do cụ thể.";
    if (refundChoice === "partial" && (partialAmount <= 0 || partialAmount > received)) return `Số tiền hoàn phải từ 1đ đến ${vnd(received)}.`;
    return "";
  }, [reason, isPending, note, refundChoice, partialAmount, received]);

  const pickReason = (code: ClosureReasonCode) => {
    const r = CLOSURE_REASONS.find((x) => x.code === code)!;
    setReasonCode(code);
    setLocalError("");
    if (received <= 0) {
      setRefundChoice("none");
      return;
    }
    setRefundChoice(r.defaultRefund);
    if (r.defaultRefund === "full") setPartialAmount(received);
  };

  const submit = async () => {
    if (validation || !reason) {
      setLocalError(validation);
      return;
    }
    setSubmitting(true);
    setLocalError("");
    try {
      const res = await apiFetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          action: "cancel",
          reasonCode: reason.code,
          reason: note.trim() || undefined,
          refundAmount,
          refundMethod: refundAmount > 0 ? refundMethod : undefined,
          refundReference: refundAmount > 0 && refundReference.trim() ? refundReference.trim() : undefined,
          expectedVersion: booking.version ?? booking.modNo,
        }),
      });
      const data = (await res.json()) as BffError & { booking?: Record<string, unknown>; message?: string };
      if (!res.ok) {
        await onError(res.status, data);
        setLocalError(data.error || "Không thể huỷ đặt phòng.");
        return;
      }
      onClosed({ booking: data.booking ?? {}, message: data.message || "Đã huỷ đặt phòng." });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-3.5 animate-in fade-in duration-200 shadow-xs">
      <div>
        <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">Huỷ đặt phòng #{booking.id}</h4>
        <p className="text-[11px] text-rose-800 mt-1 leading-relaxed font-medium">
          Đơn vẫn được lưu lại với trạng thái <strong>Đã huỷ</strong> (hoặc <strong>No-show</strong>) và phòng được giải phóng trên Bảng phòng.
          Hồ sơ thành viên và điểm tích luỹ không thay đổi.
        </p>
      </div>

      {inHouse && (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
          ⚠️ Đã qua giờ nhận phòng — khách có thể đang ở. Chỉ huỷ khi chắc chắn; tiền đã thu phải được hoàn hoặc giữ lại rõ ràng ở bước 2.
        </p>
      )}

      {/* 1. Reason */}
      <fieldset className="space-y-1.5 bg-white p-3 rounded-lg border border-rose-200 shadow-xs">
        <legend className="text-[11px] font-bold text-slate-700 px-1">1. Lý do huỷ</legend>
        {CLOSURE_REASONS.map((r) => {
          const disabled = r.code === "no_show" && isPending;
          return (
            <label key={r.code} className={`flex items-start gap-2 text-xs ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <input
                type="radio"
                name="closureReason"
                className="mt-0.5 accent-rose-600"
                disabled={disabled}
                checked={reasonCode === r.code}
                onChange={() => pickReason(r.code)}
              />
              <span>
                <span className="font-semibold text-slate-800">{r.label}</span>
                <span className="block text-[11px] text-slate-500">{disabled ? "Chỉ áp dụng cho đơn đã xác nhận." : r.hint}</span>
              </span>
            </label>
          );
        })}
        <input
          type="text"
          maxLength={500}
          placeholder={reason?.noteRequired ? "Ghi rõ lý do (bắt buộc)..." : "Ghi chú thêm (tuỳ chọn)..."}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20"
        />
      </fieldset>

      {/* 2. Money */}
      <fieldset className="space-y-2 bg-white p-3 rounded-lg border border-rose-200 shadow-xs">
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
                      className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-rose-800 font-bold border border-slate-200 cursor-pointer"
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
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-xs font-mono font-bold text-amber-700 focus:outline-none focus:border-rose-600"
                  aria-label="Số tiền hoàn"
                />
              </div>
            )}

            {refundAmount > 0 && (
              <div className="grid grid-cols-2 gap-2 pl-5">
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                  className="px-2 py-1.5 rounded-lg bg-white border border-rose-300 text-xs text-slate-800"
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
                  className="px-2 py-1.5 rounded-lg bg-white border border-rose-300 text-xs text-slate-800 placeholder-slate-400"
                />
              </div>
            )}

            <div className="p-2 rounded bg-slate-50 text-[11px] space-y-0.5 border border-slate-200">
              <div className="flex justify-between text-rose-700 font-medium">
                <span>Hoàn cho khách:</span>
                <span className="font-mono font-bold">-{vnd(refundAmount)}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-bold pt-1 border-t border-slate-200">
                <span>Khách sạn giữ lại:</span>
                <span className="font-mono">{vnd(retained)}</span>
              </div>
            </div>
          </div>
        )}
      </fieldset>

      {(localError || (reasonCode && validation)) && <p className="text-xs text-rose-700 font-semibold">{localError || validation}</p>}

      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="danger" className="flex-1 font-semibold" isLoading={submitting} disabled={submitting || !!validation} onClick={submit}>
          {reason?.code === "no_show" ? "Xác nhận No-show" : "Xác nhận huỷ"}
        </Button>
        <Button size="sm" variant="secondary" disabled={submitting} onClick={onDismiss}>
          Đóng
        </Button>
      </div>
    </div>
  );
};
