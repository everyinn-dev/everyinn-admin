"use client";
/**
 * LSB-5 — a live hold on the Gantt: hatched bar + countdown. Web guests show "🌐 Web" (name masked by Booking Core),
 * receptionist holds show "Lễ tân giữ". Disappears by itself at expiry (Booking Core's ETag only moves on writes).
 */
import React, { useEffect, useState } from "react";
import type { GanttHoldItem } from "@/types";

export function holdCountdown(expiresAt: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function holdLabel(h: GanttHoldItem): string {
  const who = h.channel === "web" ? "🌐 Web" : h.channel === "chat" ? "💬 Chat" : "🧑‍💼 Lễ tân giữ";
  const what = h.status === "awaiting_payment" ? "chờ thanh toán" : "đang giữ";
  return `${who} · ${what}`;
}

/** Re-renders once a second while mounted (countdown + self-hide at expiry). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export const GanttHoldBar: React.FC<{ hold: GanttHoldItem; left: number; width: number; onClick?: (h: GanttHoldItem) => void }> = ({ hold, left, width, onClick }) => {
  const now = useNow();
  if (Date.parse(hold.expiresAt) <= now) return null;
  const web = hold.channel === "web";
  return (
    <button
      type="button"
      onClick={() => onClick?.(hold)}
      title={`${holdLabel(hold)}${hold.guestNameMasked ? ` — ${hold.guestNameMasked}` : ""}\nCòn ${holdCountdown(hold.expiresAt, now)}${hold.payableAmount ? ` · ${hold.payableAmount.toLocaleString("vi-VN")}đ` : ""}`}
      className={`absolute top-1.5 bottom-1.5 rounded-lg border-2 border-dashed flex items-center gap-1 px-1.5 overflow-hidden z-10 text-[11px] font-bold text-left cursor-pointer transition-colors ${
        web
          ? "border-sky-500 text-sky-950 bg-[repeating-linear-gradient(45deg,rgba(14,165,233,0.12),rgba(14,165,233,0.12)_8px,rgba(14,165,233,0.25)_8px,rgba(14,165,233,0.25)_16px)] hover:border-sky-600"
          : "border-slate-400 text-slate-800 bg-[repeating-linear-gradient(45deg,rgba(100,116,139,0.10),rgba(100,116,139,0.10)_8px,rgba(100,116,139,0.22)_8px,rgba(100,116,139,0.22)_16px)] hover:border-slate-500"
      }`}
      style={{ left: `${left}px`, width: `${width}px` }}
    >
      {width >= 150 ? (
        <span className="truncate">
          {holdLabel(hold)} <span className="font-mono tabular-nums">{holdCountdown(hold.expiresAt, now)}</span>
        </span>
      ) : width >= 60 ? (
        <span className="truncate font-mono tabular-nums">{web ? "🌐" : "⏳"} {holdCountdown(hold.expiresAt, now)}</span>
      ) : (
        <span>{web ? "🌐" : "⏳"}</span>
      )}
    </button>
  );
};
