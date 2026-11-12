"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { GanttBookingItem } from "@/types";
import { apiFetch } from "@/lib/apiClient";
import type { BffError } from "@/lib/bookingClosure";
import { availableChargeKinds, CHARGE_KIND_ICON, CHARGE_KIND_LABEL, chargeNeedsReason, isTimeKind, type ChargeKind, type ChargeQuote } from "@/lib/charges";
import { BookingCommandPanel } from "@/components/bookings/shared/BookingCommandPanel";
import { MoneySummary } from "@/components/bookings/shared/MoneySummary";
import { ReasonField } from "@/components/bookings/shared/ReasonField";
import { useBookingCommand } from "@/components/bookings/shared/useBookingCommand";

interface ChargeSheetProps {
  booking: GanttBookingItem;
  initialKind: ChargeKind;
  initialHours?: number;
  onAdded: (result: { booking: Record<string, unknown>; message: string }) => void;
  /** Core rejected the command (the drawer reloads the booking on a 409). */
  onError: (status: number, data: BffError) => Promise<void> | void;
  onDismiss: () => void;
}

const vnd = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString("vi-VN")}đ`;
const fmtVn = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

/**
 * "Thêm phụ phí": ONE sheet for +N hours, early check-in, late check-out and incidental charges. The drawer's quick
 * buttons only open it with a kind already chosen. Everything shown (new times, fee, availability, money after) is
 * Booking Core's own quote — nothing is priced in the browser.
 */
export const ChargeSheet: React.FC<ChargeSheetProps> = ({ booking, initialKind, initialHours = 1, onAdded, onError, onDismiss }) => {
  const kinds = availableChargeKinds(booking.bookingType, { checkinAt: booking.checkinAt });
  const [kind, setKind] = useState<ChargeKind>(kinds.includes(initialKind) ? initialKind : kinds[0]!);
  const [hours, setHours] = useState(Math.min(6, Math.max(1, initialHours)));
  const [amount, setAmount] = useState(0);
  const [overridden, setOverridden] = useState(false);
  const [overrideFee, setOverrideFee] = useState(0);
  const [reason, setReason] = useState("");
  const [quote, setQuote] = useState<ChargeQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const { run, submitting, error } = useBookingCommand({ onError });

  const timeKind = isTimeKind(kind);
  const feeForQuote = timeKind && overridden ? overrideFee : undefined;

  // Live quote from Booking Core (debounced while typing an amount / agreed fee).
  useEffect(() => {
    if (!timeKind && amount < 1) {
      setQuote(null);
      setQuoteError("");
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      setQuoting(true);
      try {
        const res = await apiFetch(`/api/bookings/${booking.id}/charges/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, hours, amount, feeOverride: feeForQuote }),
        });
        const data = (await res.json().catch(() => ({}))) as { quote?: ChargeQuote } & BffError;
        if (!alive) return;
        if (!res.ok || !data.quote) {
          setQuote(null);
          setQuoteError(data.error || "Không lấy được báo giá từ hệ thống.");
        } else {
          setQuote(data.quote);
          setQuoteError("");
          if (!overridden) setOverrideFee(data.quote.tableFee);
        }
      } catch {
        if (alive) setQuoteError("Không lấy được báo giá từ hệ thống.");
      } finally {
        if (alive) setQuoting(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [booking.id, kind, hours, amount, feeForQuote, timeKind, overridden]);

  const fee = quote?.fee ?? 0;
  const needsReason = chargeNeedsReason(kind, overrideFee, quote?.tableFee ?? 0, overridden);

  const blockedReason = useMemo(() => {
    if (!timeKind && amount < 1) return "Nhập số tiền phát sinh.";
    if (quoteError) return "";
    if (!quote) return quoting ? "Đang tính giá…" : "";
    if (!quote.available) return quote.conflict?.message ?? "Phòng không trống trong khoảng giờ này.";
    if (needsReason && !reason.trim()) return kind === "incidental" ? "Nhập nội dung / lý do khoản phát sinh." : "Nhập lý do khi đổi phí khác bảng giá.";
    return "";
  }, [timeKind, amount, quote, quoteError, quoting, needsReason, reason, kind]);

  const submit = async () => {
    if (blockedReason || !quote) return;
    const data = await run<{ booking?: Record<string, unknown>; message?: string }>(`/api/bookings/${booking.id}/charges`, {
      kind,
      ...(timeKind ? { hours, ...(overridden ? { feeOverride: overrideFee } : {}) } : { amount }),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      expectedVersion: booking.version ?? booking.modNo,
    });
    if (data) onAdded({ booking: data.booking ?? {}, message: data.message || "Đã thêm phụ phí." });
  };

  const pickKind = (k: ChargeKind) => {
    setKind(k);
    setOverridden(false);
    setReason("");
  };

  return (
    <BookingCommandPanel
      tone="emerald"
      title={`Thêm phụ phí · đơn #${booking.id}`}
      intro="Giá và giờ do hệ thống tính. Khoản này cộng vào tổng tiền của đơn và vào số còn phải thu; tiền thu thêm ghi ở bước “Ghi nhận thanh toán”."
      submitting={submitting}
      error={error}
      blockedReason={blockedReason || undefined}
      confirmLabel="Thêm phụ phí"
      confirmVariant="primary"
      onConfirm={submit}
      onDismiss={onDismiss}
    >
      {/* Kind */}
      <div role="group" aria-label="Loại phụ phí" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => pickKind(k)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold text-left cursor-pointer transition-colors ${
              kind === k ? "bg-white border-emerald-600 ring-2 ring-emerald-600/20 text-emerald-900" : "bg-white/60 border-slate-300 text-slate-700 hover:bg-white"
            }`}
          >
            <span aria-hidden="true">{CHARGE_KIND_ICON[k]}</span> {CHARGE_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {timeKind ? (
        <div className="space-y-3 bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold text-slate-700">Số giờ</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Bớt 1 giờ" disabled={hours <= 1} onClick={() => setHours((h) => Math.max(1, h - 1))} className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-base font-bold text-slate-700 disabled:opacity-40 cursor-pointer">
                −
              </button>
              <span className="w-10 text-center font-mono text-sm font-extrabold text-slate-900">{hours}h</span>
              <button type="button" aria-label="Thêm 1 giờ" disabled={hours >= 6} onClick={() => setHours((h) => Math.min(6, h + 1))} className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-base font-bold text-slate-700 disabled:opacity-40 cursor-pointer">
                +
              </button>
            </div>
          </div>

          {quote && (
            <dl className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <dt className="text-slate-500">Nhận phòng</dt>
                <dd className="font-mono font-bold text-slate-800">{fmtVn(quote.newCheckinAt)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-slate-500">Trả phòng</dt>
                <dd className="font-mono font-bold text-slate-800">{fmtVn(quote.newCheckoutAt)}</dd>
              </div>
            </dl>
          )}

          {quote && !quote.available && (
            <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800 space-y-1.5">
              <p>{quote.conflict?.message ?? "Phòng không trống trong khoảng giờ này."}</p>
              {quote.maxHours > 0 ? (
                <button type="button" onClick={() => setHours(quote.maxHours)} className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 cursor-pointer">
                  Chỉ còn trống tối đa {quote.maxHours}h — chọn {quote.maxHours}h
                </button>
              ) : (
                <p>Không thêm được giờ nào vì đã có khách kế tiếp.</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate-600">Giá bảng</span>
            <span className="font-mono font-bold text-slate-800">{quote ? vnd(quote.tableFee) : "…"}</span>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" className="accent-emerald-600" checked={overridden} onChange={(e) => setOverridden(e.target.checked)} />
            Thoả thuận giá khác bảng giá (cần lý do)
          </label>
          {overridden && (
            <div className="space-y-1">
              <label htmlFor="charge-override-fee" className="block text-[11px] font-bold text-slate-700">
                Phí áp dụng (VNĐ)
              </label>
              <input
                id="charge-override-fee"
                type="number"
                min={0}
                step={1000}
                value={overrideFee}
                onChange={(e) => setOverrideFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
          <label htmlFor="charge-amount" className="block text-[11px] font-bold text-slate-700">
            Số tiền phát sinh (VNĐ) <span className="text-rose-600">*</span>
          </label>
          <input
            id="charge-amount"
            type="number"
            min={1}
            step={1000}
            value={amount || ""}
            onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          />
          <p className="text-[11px] text-slate-500">Cộng thẳng vào tổng tiền, không áp dụng giảm giá.</p>
        </div>
      )}

      <ReasonField
        label={kind === "incidental" ? "Nội dung phát sinh" : overridden ? "Lý do đổi phí" : "Ghi chú (tuỳ chọn)"}
        required={needsReason}
        value={reason}
        onChange={setReason}
        placeholder={kind === "incidental" ? "VD: Đền bù vỡ ly, minibar, giặt ủi" : undefined}
      />

      {quoteError && <p role="alert" className="text-xs text-rose-700 font-semibold">{quoteError}</p>}

      {quote && (
        <MoneySummary
          rows={[
            { label: "Phụ phí này", value: fee, signed: true },
            { label: "Tổng tiền đơn", value: quote.totalAfter },
            { label: "Khách đã trả", value: quote.netPaid },
            { label: "Còn phải thu sau khi thêm", value: quote.remainingAfter, strong: true, tone: quote.remainingAfter > 0 ? "bad" : "good" },
          ]}
        />
      )}
    </BookingCommandPanel>
  );
};
