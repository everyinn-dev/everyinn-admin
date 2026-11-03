"use client";

import React, { useState } from "react";
import { agentApi, AgentApiError, formatVnd, formatVnTime, type AgentEscalation } from "@/lib/agentApi";
import { useToast } from "@/components/ui/Toast";

const TYPE_LABEL: Record<AgentEscalation["type"], string> = {
  CONFIRM_HOLD_PAYMENT: "⏳ Đợi xác nhận thanh toán",
  REQUEST_DOOR_CODE: "🔑 Cần mã cửa",
  PRICE_NEGOTIATION: "💬 Khách mặc cả",
  FACILITY_ISSUE: "🚨 Sự cố",
  GENERAL_HELP: "🙋 Cần quản lý hỗ trợ",
  CHECKIN_REMINDER: "📨 Nhắc gửi hướng dẫn",
};

/** One-click owner actions. Confirm calls Booking Core with THIS staff member as actor (never the bot). */
export function EscalationCard({ esc, onDone }: { esc: AgentEscalation; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const d = esc.details as Record<string, any>;

  const resolve = async (action: "confirm_deposit" | "confirm_full" | "reject" | "resolve") => {
    setBusy(true);
    try {
      const res = await agentApi<{ bookingId?: string; replayed?: boolean }>(`escalations/${esc.id}/resolve`, { method: "POST", body: { action } });
      if (res.data?.bookingId) toast.success(`Đã lên đơn ${res.data.bookingId}${res.data.replayed ? " (đã xác nhận trước đó)" : ""}`, "Xác nhận thanh toán");
      else toast.success("Đã cập nhật phiếu.");
      onDone();
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const saveCode = async () => {
    if (!/^[0-9*#\s]{3,16}$/.test(code)) return toast.warning("Mã cửa chỉ gồm số, * hoặc #.");
    setBusy(true);
    try {
      const missing = (d.missing as string[] | undefined) ?? ["gate"];
      if (missing.includes("gate") && esc.bookingId) {
        await agentApi(`bookings/${esc.bookingId}/door-code`, { method: "PUT", body: { gateCode: code, note: "Nhập từ Hộp thư AI" } });
      } else if (esc.roomId) {
        await agentApi(`door-codes/lockbox/${esc.roomId}`, { method: "PUT", body: { code } });
      }
      toast.success("Đã lưu mã — hướng dẫn nhận phòng sẽ được gửi ngay.");
      setCode("");
      onDone();
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Không lưu được mã.");
    } finally {
      setBusy(false);
    }
  };

  const border = esc.severity === "critical" ? "border-rose-300 bg-rose-50/60" : esc.type === "CONFIRM_HOLD_PAYMENT" ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white";
  return (
    <div className={`p-3.5 rounded-xl border shadow-xs space-y-2.5 ${border}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black text-slate-800">{TYPE_LABEL[esc.type]}</p>
        <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatVnTime(esc.createdAt)}</span>
      </div>
      <p className="text-xs text-slate-700">{esc.summary}</p>

      {esc.type === "CONFIRM_HOLD_PAYMENT" && (
        <>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            <dt className="text-slate-500">Phòng</dt>
            <dd className="font-bold text-slate-800 text-right">{d.roomLabel} · {d.numGuests} khách</dd>
            <dt className="text-slate-500">Nhận → Trả</dt>
            <dd className="font-medium text-slate-800 text-right">{d.checkinAt ? formatVnTime(d.checkinAt) : "—"} → {d.checkoutAt ? formatVnTime(d.checkoutAt) : "—"}</dd>
            <dt className="text-slate-500">Khách</dt>
            <dd className="font-medium text-slate-800 text-right">{d.guestName} · {d.phoneMasked}</dd>
            <dt className="text-slate-500">Tổng đơn</dt>
            <dd className="font-bold text-slate-900 text-right">{formatVnd(Number(d.total ?? 0))}</dd>
            <dt className="text-slate-500">Cần thu</dt>
            <dd className="font-black text-emerald-800 text-right">{formatVnd(Number(d.payable ?? 0))} {d.isDeposit ? "(cọc)" : "(đủ)"}</dd>
            <dt className="text-slate-500">Nội dung CK</dt>
            <dd className="font-mono font-bold text-slate-800 text-right">{d.paymentReference}</dd>
            <dt className="text-slate-500">Giữ đến</dt>
            <dd className="text-slate-700 text-right">{d.holdExpiresAt ? formatVnTime(d.holdExpiresAt) : "—"}</dd>
          </dl>
          <div className="flex flex-col gap-1.5">
            {d.isDeposit && (
              <button disabled={busy} onClick={() => resolve("confirm_deposit")} className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                ✅ Đã nhận cọc {formatVnd(Number(d.payable ?? 0))}
              </button>
            )}
            <button disabled={busy} onClick={() => resolve("confirm_full")} className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 disabled:opacity-50">
              ✅ Đã nhận đủ {formatVnd(Number(d.total ?? 0))}
            </button>
            <button disabled={busy} onClick={() => resolve("reject")} className="w-full px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
              ❌ Chưa nhận được tiền
            </button>
          </div>
        </>
      )}

      {esc.type === "REQUEST_DOOR_CODE" && (
        <div className="flex gap-1.5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={(d.missing as string[] | undefined)?.includes("gate") ? "Mã cổng, VD 2580#" : "Mã hộp khóa, VD 1234"}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-base sm:text-sm font-mono"
            inputMode="numeric"
          />
          <button disabled={busy || !code} onClick={saveCode} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-50 whitespace-nowrap">
            Gửi khách
          </button>
        </div>
      )}

      {(esc.type === "PRICE_NEGOTIATION" || esc.type === "FACILITY_ISSUE" || esc.type === "GENERAL_HELP" || esc.type === "CHECKIN_REMINDER") && (
        <button disabled={busy} onClick={() => resolve("resolve")} className="w-full px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50">
          ✅ Đã xử lý
        </button>
      )}
    </div>
  );
}
