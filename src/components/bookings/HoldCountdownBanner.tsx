"use client";

import React, { useEffect, useState } from "react";

interface HoldCountdownBannerProps {
  holdId: string;
  roomName: string;
  expiresAt: string; // ISO-8601 UTC from Booking Core
  stepLabel: string;
  releasing?: boolean;
  onExitAndReselect: () => void;
  onExpired: () => void;
}

const TOTAL_HOLD_SECONDS = 15 * 60;

export const HoldCountdownBanner: React.FC<HoldCountdownBannerProps> = ({
  holdId,
  roomName,
  expiresAt,
  stepLabel,
  releasing = false,
  onExitAndReselect,
  onExpired,
}) => {
  const [remainingSec, setRemainingSec] = useState<number>(() => {
    const diff = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  useEffect(() => {
    const expiryMs = Date.parse(expiresAt);
    if (Number.isNaN(expiryMs)) return;

    const tick = () => {
      const next = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
      setRemainingSec(next);
      if (next <= 0) {
        onExpired();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const progressPct = Math.min(100, Math.max(0, (remainingSec / TOTAL_HOLD_SECONDS) * 100));

  const isCritical = remainingSec <= 60;
  const isWarning = remainingSec > 60 && remainingSec <= 180;

  const containerStyle = isCritical
    ? "bg-rose-50/95 border-rose-300 text-rose-950 shadow-sm"
    : isWarning
    ? "bg-amber-50/95 border-amber-300 text-amber-950 shadow-sm"
    : "bg-emerald-50/95 border-emerald-300 text-emerald-950 shadow-xs";

  const timerBadgeStyle = isCritical
    ? "bg-rose-600 text-white animate-pulse"
    : isWarning
    ? "bg-amber-600 text-white"
    : "bg-emerald-700 text-white";

  const barColor = isCritical
    ? "bg-rose-600"
    : isWarning
    ? "bg-amber-500"
    : "bg-emerald-600";

  return (
    <div
      className={`sticky top-2 z-30 rounded-2xl border backdrop-blur-md transition-colors duration-300 overflow-hidden ${containerStyle}`}
      role="region"
      aria-label="Bộ đếm ngược giữ phòng 15 phút"
    >
      <div className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 rounded-xl font-mono text-base sm:text-lg font-extrabold tracking-wider shrink-0 shadow-xs flex items-center gap-1.5 ${timerBadgeStyle}`}
            aria-live="polite"
          >
            <span>⏳</span>
            <span>{formattedTime}</span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-extrabold">
                Đang giữ khóa tạm thời: {roomName}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/80 border border-black/10 text-slate-700">
                #{holdId.slice(0, 12)}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs opacity-85 mt-0.5">
              {stepLabel} — Phòng đang được khóa trong 15 phút để hoàn tất nhập thông tin & thanh toán.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onExitAndReselect}
          disabled={releasing}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        >
          <span>🚪</span>
          <span>{releasing ? "Đang hủy giữ phòng..." : "Thoát & Chọn lại"}</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 w-full bg-black/5">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${barColor}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
};

