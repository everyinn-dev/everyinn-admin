"use client";

import React from "react";
import Link from "next/link";
import type { GanttBookingItem } from "@/types";
import { closureReasonLabel, netReceivedOf } from "@/lib/bookingClosure";

const vnd = (n: number | undefined) => `${Math.max(0, Math.round(n ?? 0)).toLocaleString("vi-VN")} đ`;
const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

/** Read-only state of a closed booking (cancelled or no-show): why, who, when and where the money ended up. */
export const ClosedBookingBanner: React.FC<{ booking: GanttBookingItem }> = ({ booking: b }) => {
  const isNoShow = b.status === "no_show";
  const code = b.closureReasonCode ?? (isNoShow ? "no_show" : null);
  const reasonLabel = closureReasonLabel(code) ?? (isNoShow ? "Khách không đến (No-show)" : "Đã huỷ");
  const note = isNoShow ? b.noShowReason : b.cancelReason;
  const at = isNoShow ? b.noShowAt : b.cancelledAt;
  const by = isNoShow ? b.noShowByStaffName : b.cancelledByStaffName;
  const paid = b.paidAmount ?? 0;
  const refunded = b.refundAmount ?? 0;
  const retained = netReceivedOf(b);
  const tone = isNoShow
    ? { box: "bg-purple-50 border-purple-200", title: "text-purple-900", pill: "bg-purple-100 text-purple-800 border-purple-300" }
    : { box: "bg-slate-100 border-slate-300", title: "text-slate-900", pill: "bg-slate-200 text-slate-700 border-slate-300" };

  return (
    <div className={`p-4 rounded-2xl border shadow-xs space-y-3 ${tone.box}`} role="status">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${tone.title}`}>{isNoShow ? "🚫 Khách không đến (No-show)" : "⛔ Đơn đã huỷ"}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${tone.pill}`}>Chỉ xem · Đã giải phóng phòng</span>
      </div>

      <dl className="text-xs text-slate-700 space-y-1.5 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Lý do:</dt>
          <dd className="font-semibold text-right">{reasonLabel}</dd>
        </div>
        {note && note !== reasonLabel && (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500 shrink-0">Ghi chú:</dt>
            <dd className="italic text-right">{note}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Thời điểm:</dt>
          <dd className="font-mono">{fmt(at)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Người xử lý:</dt>
          <dd className="font-semibold">{by || "—"}</dd>
        </div>
        <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <dt className="text-slate-500">Đã thu</dt>
            <dd className="font-mono font-bold text-slate-800">{vnd(paid)}</dd>
          </div>
          <div className="text-center">
            <dt className="text-slate-500">Đã hoàn</dt>
            <dd className="font-mono font-bold text-rose-700">{vnd(refunded)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-slate-500">Giữ lại</dt>
            <dd className="font-mono font-extrabold text-emerald-700">{vnd(retained)}</dd>
          </div>
        </div>
        {typeof b.originalPrice === "number" && (
          <div className="flex justify-between gap-2 text-[11px] text-slate-500">
            <dt>Giá trị đơn trước khi huỷ:</dt>
            <dd className="font-mono">{vnd(b.originalPrice)}</dd>
          </div>
        )}
      </dl>

      <Link
        href={`/bookings/new?phone=${encodeURIComponent(b.phone)}&name=${encodeURIComponent(b.guestName)}`}
        className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-300 flex items-center justify-center gap-2"
      >
        🔄 Tạo đơn mới cho khách này
      </Link>
    </div>
  );
};
