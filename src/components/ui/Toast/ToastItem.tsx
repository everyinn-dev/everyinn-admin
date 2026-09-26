"use client";

import React, { useEffect, useState, useRef } from "react";
import { ToastItem as ToastItemType } from "./ToastContext";

interface ToastItemProps {
  toast: ToastItemType;
  onClose: (id: string) => void;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(toast.duration);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss & progress calculation
  useEffect(() => {
    if (toast.duration <= 0) return;

    const startTimer = () => {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        onClose(toast.id);
      }, remainingTimeRef.current);

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const currentRemaining = Math.max(0, remainingTimeRef.current - elapsed);
        const percent = (currentRemaining / toast.duration) * 100;
        setProgress(percent);
      }, 50);
    };

    if (!isPaused && !toast.isExiting) {
      startTimer();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, toast.duration, toast.id, toast.isExiting, onClose]);

  const handleMouseEnter = () => {
    if (toast.duration <= 0) return;
    setIsPaused(true);
    // Calculate remaining time
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleMouseLeave = () => {
    if (toast.duration <= 0) return;
    setIsPaused(false);
  };

  // Theme configuration for each toast type
  const theme = {
    success: {
      container:
        "bg-[#0d1e17]/95 border-emerald-500/50 text-emerald-100 shadow-[0_12px_32px_rgba(16,185,129,0.25)]",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      title: "text-emerald-300",
      progressBar: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
      icon: (
        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      ),
    },
    warning: {
      container:
        "bg-[#241707]/95 border-amber-500/60 text-amber-100 shadow-[0_12px_32px_rgba(245,158,11,0.25)]",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      title: "text-amber-300",
      progressBar: "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
      icon: (
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
      ),
    },
    error: {
      container:
        "bg-[#260e13]/95 border-rose-500/60 text-rose-100 shadow-[0_12px_32px_rgba(244,63,94,0.3)]",
      badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      title: "text-rose-300",
      progressBar: "bg-rose-500 shadow-[0_0_8px_#f43f5e]",
      icon: (
        <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ),
    },
    info: {
      container:
        "bg-[#0e1628]/95 border-indigo-500/50 text-indigo-100 shadow-[0_12px_32px_rgba(99,102,241,0.25)]",
      badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      title: "text-indigo-300",
      progressBar: "bg-indigo-400 shadow-[0_0_8px_#818cf8]",
      icon: (
        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
        </div>
      ),
    },
  }[toast.type];

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-xl p-4 transition-all duration-200 select-none ${
        theme.container
      } ${toast.isExiting ? "animate-toast-out" : "animate-toast-in"}`}
    >
      <div className="flex items-start gap-3">
        {theme.icon}

        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-xs font-extrabold uppercase tracking-wider ${theme.title}`}>
              {toast.title}
            </h4>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed break-words font-medium">
            {toast.message}
          </p>

          {/* Action button if provided */}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onClose(toast.id);
              }}
              className="mt-2.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors border border-white/20 active:scale-95"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => onClose(toast.id)}
          className="w-6 h-6 rounded-lg bg-black/20 hover:bg-black/40 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors shrink-0"
          aria-label="Đóng thông báo"
        >
          ✕
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-black/30">
          <div
            className={`h-full transition-all duration-75 ${theme.progressBar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
