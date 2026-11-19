"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { formatDateTimeShort } from "@/lib/timelineUtils";
import { vnLocalInputValue } from "@/lib/vnTime";
import { balanceOf, canReverse, ENTRY_LABELS, methodLabel, PAYMENT_METHODS, type LedgerAction, type LedgerEntry } from "@/lib/ledger";
import type { GanttBookingItem } from "@/types";

export interface LedgerIntent {
  action: Exclude<LedgerAction, "reverse">;
  amount: number;
  reason?: string;
}

interface LedgerSectionProps {
  booking: GanttBookingItem;
  isManager: boolean;
  /** Opens the form prefilled (e.g. "collect the difference" after an edit). */
  intent?: LedgerIntent | null;
  onIntentConsumed?: () => void;
  onChanged: (r: { booking: Record<string, unknown> | null; message: string }) => void;
}

const vnd = (n: number) => `${n.toLocaleString("vi-VN")} đ`;
const inputCls = "w-full rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600";

/**
 * "Sổ thu tiền" — every money movement of the booking (EI-FINANCE-ONTOLOGY-001 §8): what was received / refunded,
 * how and WHEN. Corrections are new entries (refund, adjustment, reversal); nothing is edited or deleted.
 */
export const LedgerSection: React.FC<LedgerSectionProps> = ({ booking, isManager, intent, onIntentConsumed, onChanged }) => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ action: LedgerAction; amount: number; method: string; occurredAt: string; reason: string; entryId?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const live = booking.status !== "cancelled" && booking.status !== "no_show";
  const bal = balanceOf({ totalPrice: booking.totalPrice, paidAmount: booking.paidAmount, refundAmount: booking.refundAmount, status: booking.status });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/bookings/${booking.id}/ledger`, { cache: "no-store" });
      if (res.ok) setEntries(((await res.json()) as { entries: LedgerEntry[] }).entries);
    } finally {
      setLoading(false);
    }
  }, [booking.id]);

  useEffect(() => {
    load();
  }, [load, booking.paidAmount, booking.refundAmount]);

  const open = (action: LedgerAction, amount = 0, extra: { reason?: string; entryId?: string } = {}) => {
    setError("");
    setForm({ action, amount, method: "cash", occurredAt: vnLocalInputValue(Date.now()), reason: extra.reason ?? "", entryId: extra.entryId });
  };

  useEffect(() => {
    if (!intent) return;
    open(intent.action, intent.amount, { reason: intent.reason });
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/bookings/${booking.id}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `adm.ledger.${crypto.randomUUID()}` },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; message?: string; booking?: Record<string, unknown> | null };
      if (!res.ok) {
        setError(data.error || "Không ghi được bút toán.");
        return;
      }
      setForm(null);
      await load();
      onChanged({ booking: data.booking ?? null, message: data.message || "Đã ghi sổ thu tiền." });
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setSaving(false);
    }
  };

  const title: Record<LedgerAction, string> = {
    payment: "💰 Ghi nhận thu tiền",
    refund: "↩️ Hoàn tiền cho khách",
    adjustment: "⚖️ Điều chỉnh (quản lý)",
    reverse: "🔁 Đảo bút toán (quản lý)",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Sổ thu tiền</span>
        <span className="text-[11px] text-slate-500">Đã thu ròng: <b className="text-slate-800">{vnd(bal.netReceived)}</b></span>
      </div>

      {bal.due > 0 && <p className="text-[11px] font-semibold text-amber-800">Còn phải thu: {vnd(bal.due)}</p>}
      {bal.overpaid > 0 && (
        <p className="text-[11px] font-semibold text-rose-700">
          Thu thừa {vnd(bal.overpaid)} — đang nợ khách.{" "}
          <button type="button" className="underline" onClick={() => open("refund", bal.overpaid, { reason: "Hoàn phần thu thừa" })}>
            Hoàn phần thừa
          </button>
        </p>
      )}

      {/* Actions */}
      {!form && (
        <div className="flex flex-wrap gap-1.5">
          {live && bal.due > 0 && (
            <button type="button" onClick={() => open("payment", bal.due)} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold">
              💰 Thu tiền ({vnd(bal.due)})
            </button>
          )}
          {bal.netReceived > 0 && (
            <button type="button" onClick={() => open("refund", 0)} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold">
              ↩️ Hoàn tiền
            </button>
          )}
          {isManager && (
            <button type="button" onClick={() => open("adjustment", 0)} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold">
              ⚖️ Điều chỉnh
            </button>
          )}
        </div>
      )}

      {/* Form */}
      {form && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">{title[form.action]}</span>
            <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-700 text-xs font-bold">✕</button>
          </div>
          {form.action !== "reverse" && (
            <>
              <label className="block text-[11px] font-bold text-slate-700">
                Số tiền (VNĐ){form.action === "adjustment" ? " — âm để giảm" : ""}
                <input type="number" step="1000" className={inputCls} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-bold text-slate-700">
                  Phương thức
                  <select className={inputCls} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-bold text-slate-700">
                  {form.action === "refund" ? "Ngày giờ chi" : "Ngày giờ nhận"}
                  <input type="datetime-local" className={inputCls} max={vnLocalInputValue(Date.now())} value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} />
                </label>
              </div>
            </>
          )}
          <label className="block text-[11px] font-bold text-slate-700">
            {form.action === "payment" ? "Ghi chú (tuỳ chọn)" : "Lý do *"}
            <input type="text" maxLength={500} className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={form.action === "payment" ? "VD: Khách chuyển khoản VCB" : "Bắt buộc"} />
          </label>
          {error && <p className="text-[11px] text-rose-700 font-medium">⚠️ {error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(null)} className="flex-1 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold">Huỷ</button>
            <button type="button" disabled={saving} onClick={submit} className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">
              {saving ? "Đang lưu..." : "Ghi sổ"}
            </button>
          </div>
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <p className="text-[11px] text-slate-400">Đang tải sổ thu tiền…</p>
      ) : entries.length === 0 ? (
        <p className="text-[11px] text-slate-400">Chưa có khoản thu / chi nào.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="py-1.5 flex items-start justify-between gap-2 text-[11px]">
              <div className="min-w-0">
                <span className="font-semibold text-slate-800">{ENTRY_LABELS[e.entryType]}</span>
                <span className="text-slate-500"> · {methodLabel(e.method)} · {formatDateTimeShort(e.occurredAt)}</span>
                {(e.reason || e.actor?.name) && (
                  <span className="block text-slate-400 truncate">
                    {e.reason ?? ""}
                    {e.reason && e.actor?.name ? " — " : ""}
                    {e.actor?.name ?? ""}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className={`font-mono font-bold ${e.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {e.amount > 0 ? "+" : ""}
                  {vnd(e.amount)}
                </span>
                {isManager && canReverse(e, entries) && !form && (
                  <button type="button" onClick={() => open("reverse", 0, { entryId: e.id })} className="block ml-auto text-[10px] text-slate-500 hover:text-rose-700 underline">
                    Đảo
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
