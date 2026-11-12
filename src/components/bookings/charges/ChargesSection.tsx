"use client";

import React, { useState } from "react";
import type { GanttBookingItem } from "@/types";
import type { BffError } from "@/lib/bookingClosure";
import { CHARGE_KIND_ICON, CHARGE_KIND_LABEL, chargePresets, type ChargeKind, type ChargeLine } from "@/lib/charges";
import { BookingCommandPanel } from "@/components/bookings/shared/BookingCommandPanel";
import { MoneySummary } from "@/components/bookings/shared/MoneySummary";
import { ReasonField } from "@/components/bookings/shared/ReasonField";
import { useBookingCommand } from "@/components/bookings/shared/useBookingCommand";
import { ChargeSheet } from "./ChargeSheet";

interface ChargesSectionProps {
  booking: GanttBookingItem;
  /** Closed or past-checkout bookings only list their charges. */
  readOnly: boolean;
  onChanged: (result: { booking: Record<string, unknown>; message: string }) => void;
  onError: (status: number, data: BffError) => Promise<void> | void;
}

const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
const when = (iso: string) => (iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "");

/**
 * "Phụ phí & phát sinh": every charge added after the booking was created (+N hours, early check-in, late
 * check-out, incidental) as one list, and the quick buttons that open the single "Thêm phụ phí" sheet.
 */
export const ChargesSection: React.FC<ChargesSectionProps> = ({ booking, readOnly, onChanged, onError }) => {
  const [sheet, setSheet] = useState<{ kind: ChargeKind; hours: number } | null>(null);
  const [voiding, setVoiding] = useState<ChargeLine | null>(null);
  const lines = booking.charges ?? [];
  const presets = chargePresets(booking.bookingType);

  if (readOnly && lines.length === 0) return null;

  return (
    <section aria-label="Phụ phí và phát sinh" className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800">Phụ phí &amp; phát sinh</h4>
        <span className="text-[11px] font-medium text-slate-500">{lines.filter((l) => !l.voided).length} khoản</span>
      </div>

      {!readOnly && !sheet && !voiding && (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={`${p.kind}-${p.id}`}
              type="button"
              onClick={() => setSheet({ kind: p.kind, hours: p.hours || 1 })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-900 shadow-xs hover:bg-emerald-50 cursor-pointer"
            >
              <span aria-hidden="true">{CHARGE_KIND_ICON[p.kind]}</span>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {lines.length === 0 ? (
        <p className="text-[11px] text-slate-500">Chưa có khoản nào. Dùng các nút trên để thêm giờ hoặc ghi một khoản phát sinh.</p>
      ) : (
        <ul className="space-y-1.5">
          {lines.map((l) => (
            <li key={l.id} className={`rounded-xl border bg-white px-3 py-2 text-xs ${l.voided ? "border-slate-200 text-slate-400" : "border-slate-200 text-slate-800"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`font-bold ${l.voided ? "line-through" : ""}`}>
                    <span aria-hidden="true">{CHARGE_KIND_ICON[l.kind]}</span> {CHARGE_KIND_LABEL[l.kind]}
                    {l.hours ? ` ${l.hours}h` : ""}
                  </div>
                  {l.reason && <div className="text-[11px] text-slate-500 break-words">{l.reason}</div>}
                  <div className="text-[11px] text-slate-400">
                    {[l.staffName, when(l.at)].filter(Boolean).join(" · ")}
                    {l.legacy && !l.staffName ? "Ghi từ phiên bản cũ" : ""}
                  </div>
                  {l.voided && <div className="text-[11px] text-slate-500">Đã huỷ: {l.voided.reason}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <div className={`font-mono font-extrabold ${l.voided ? "line-through" : ""}`}>{vnd(l.fee)}</div>
                  {!l.voided && l.fee !== l.tableFee && l.kind !== "incidental" && <div className="text-[10px] text-amber-700">giá bảng {vnd(l.tableFee)}</div>}
                  {!readOnly && !l.voided && l.kind === "incidental" && (
                    <button type="button" onClick={() => { setSheet(null); setVoiding(l); }} className="mt-0.5 text-[11px] font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-900 cursor-pointer">
                      Huỷ khoản này
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sheet && (
        <ChargeSheet
          key={`${sheet.kind}-${sheet.hours}`}
          booking={booking}
          initialKind={sheet.kind}
          initialHours={sheet.hours}
          onError={onError}
          onDismiss={() => setSheet(null)}
          onAdded={(r) => {
            setSheet(null);
            onChanged(r);
          }}
        />
      )}

      {voiding && (
        <VoidChargePanel
          booking={booking}
          line={voiding}
          onError={onError}
          onDismiss={() => setVoiding(null)}
          onVoided={(r) => {
            setVoiding(null);
            onChanged(r);
          }}
        />
      )}
    </section>
  );
};

const VoidChargePanel: React.FC<{
  booking: GanttBookingItem;
  line: ChargeLine;
  onError: (status: number, data: BffError) => Promise<void> | void;
  onDismiss: () => void;
  onVoided: (result: { booking: Record<string, unknown>; message: string }) => void;
}> = ({ booking, line, onError, onDismiss, onVoided }) => {
  const [reason, setReason] = useState("");
  const { run, submitting, error } = useBookingCommand({ onError });
  const submit = async () => {
    if (!reason.trim()) return;
    const data = await run<{ booking?: Record<string, unknown>; message?: string }>(`/api/bookings/${booking.id}/charges/${encodeURIComponent(line.id)}/void`, {
      reason: reason.trim(),
      expectedVersion: booking.version ?? booking.modNo,
    });
    if (data) onVoided({ booking: data.booking ?? {}, message: data.message || "Đã huỷ khoản phát sinh." });
  };
  return (
    <BookingCommandPanel
      tone="amber"
      title="Huỷ khoản phát sinh"
      intro={`Khoản “${line.reason ?? CHARGE_KIND_LABEL[line.kind]}” (${vnd(line.fee)}) được giữ lại trong danh sách với dấu đã huỷ và trừ khỏi tổng tiền.`}
      submitting={submitting}
      error={error}
      blockedReason={reason.trim() ? undefined : "Nhập lý do huỷ khoản này."}
      confirmLabel="Huỷ khoản phát sinh"
      onConfirm={submit}
      onDismiss={onDismiss}
    >
      <ReasonField label="Lý do huỷ" required value={reason} onChange={setReason} placeholder="VD: Nhập nhầm, khách đã tự thanh toán" />
      <MoneySummary rows={[{ label: "Trừ khỏi tổng tiền", value: -line.fee, signed: true, tone: "good" }]} />
    </BookingCommandPanel>
  );
};
