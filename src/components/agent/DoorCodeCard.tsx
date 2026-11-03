"use client";

import React, { useEffect, useState } from "react";
import { agentApi, AgentApiError } from "@/lib/agentApi";
import { useToast } from "@/components/ui/Toast";

interface Resolution {
  resolved: { gate: { source: "override" | "vault" } | null; lockbox: boolean; missing: Array<"gate" | "lockbox"> };
  gateCode: string | null;
  lockboxCode: string | null;
  overrideNote?: string | null;
}

/**
 * Door codes for one booking (OD-4): resolved from agent-db (per-booking override → vault gate code; fixed lockbox).
 * Codes are hidden until "Hiện mã" — they never live in Booking Core.
 */
export function DoorCodeCard({ bookingId, roomId, checkinAt, checkoutAt }: { bookingId: string; roomId: string; checkinAt: string; checkoutAt: string }) {
  const toast = useToast();
  const [data, setData] = useState<Resolution | null>(null);
  const [reveal, setReveal] = useState(false);
  const [override, setOverride] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const qs = `roomId=${encodeURIComponent(roomId)}&checkinAt=${encodeURIComponent(new Date(checkinAt).toISOString())}&checkoutAt=${encodeURIComponent(new Date(checkoutAt).toISOString())}`;

  const load = async (withCodes: boolean) => {
    try {
      const r = await agentApi<Resolution>(`bookings/${encodeURIComponent(bookingId)}/door-code?${qs}${withCodes ? "&reveal=1" : ""}`);
      setData(r.data);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
  };
  useEffect(() => {
    setReveal(false);
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, roomId, checkinAt, checkoutAt]);

  const saveOverride = async () => {
    try {
      await agentApi(`bookings/${encodeURIComponent(bookingId)}/door-code`, { method: "PUT", body: { gateCode: override, note: "Mã riêng cho đơn" } });
      toast.success("Đã lưu mã cổng riêng cho đơn này.");
      setOverride("");
      await load(reveal);
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Không lưu được mã.");
    }
  };

  if (unavailable) return null; // AI receptionist not deployed in this environment — hide quietly
  const missing = data?.resolved.missing ?? [];
  return (
    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">🔑 Mã cửa</span>
        <button
          onClick={() => {
            const next = !reveal;
            setReveal(next);
            void load(next);
          }}
          className="text-[11px] font-bold text-emerald-700 hover:underline"
        >
          {reveal ? "Ẩn mã" : "Hiện mã"}
        </button>
      </div>
      {data && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-white border border-slate-200">
            <p className="text-slate-500">Mã cổng {data.resolved.gate?.source === "override" ? "(riêng đơn)" : ""}</p>
            <p className={`font-mono font-bold ${data.resolved.gate ? "text-slate-900" : "text-amber-700"}`}>{data.resolved.gate ? (reveal ? data.gateCode : "••••") : "Chưa có"}</p>
          </div>
          <div className="p-2 rounded-lg bg-white border border-slate-200">
            <p className="text-slate-500">Hộp khóa phòng</p>
            <p className={`font-mono font-bold ${data.resolved.lockbox ? "text-slate-900" : "text-amber-700"}`}>{data.resolved.lockbox ? (reveal ? data.lockboxCode : "••••") : "Chưa có"}</p>
          </div>
        </div>
      )}
      {missing.length > 0 && <p className="text-[11px] text-amber-700">Thiếu {missing.map((m) => (m === "gate" ? "mã cổng" : "mã hộp khóa")).join(" + ")} — AI sẽ hỏi bạn qua Telegram trước giờ gửi hướng dẫn.</p>}
      <div className="flex gap-1.5">
        <input value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Mã cổng riêng cho đơn (tuỳ chọn)" className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-base sm:text-sm font-mono bg-white" inputMode="numeric" />
        <button disabled={!override} onClick={saveOverride} className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white disabled:opacity-50">
          Lưu
        </button>
      </div>
    </div>
  );
}
