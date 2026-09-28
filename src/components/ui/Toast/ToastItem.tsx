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
  const startTimeRef = useRef<number>(0);
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
        "bg-white/95 border-emerald-300 text-slate-800 shadow-[0_12px_32px_rgba(0,0,0,0.12)]",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
      title: "text-emerald-700",
      progressBar: "bg-emerald-500",
      icon: (
        <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      ),
    },
    warning: {
      container:
        "bg-white/95 border-amber-300 text-slate-800 shadow-[0_12px_32px_rgba(0,0,0,0.12)]",
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      title: "text-amber-700",
      progressBar: "bg-amber-500",
      icon: (
        <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
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
        "bg-white/95 border-rose-300 text-slate-800 shadow-[0_12px_32px_rgba(0,0,0,0.12)]",
      badge: "bg-rose-100 text-rose-800 border-rose-300",
      title: "text-rose-700",
      progressBar: "bg-rose-500",
      icon: (
        <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ),
    },
    info: {
      container:
        "bg-white/95 border-indigo-300 text-slate-800 shadow-[0_12px_32px_rgba(0,0,0,0.12)]",
      badge: "bg-indigo-100 text-indigo-800 border-indigo-300",
      title: "text-indigo-700",
      progressBar: "bg-indigo-500",
      icon: (
        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
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

          <p className="text-xs text-slate-600 leading-relaxed break-words font-medium">
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
              className="mt-2.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 transition-colors border border-slate-300 active:scale-95"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => onClose(toast.id)}
          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-xs transition-colors shrink-0"
          aria-label="Đóng thông báo"
        >
          ✕
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-100">
          <div
            className={`h-full transition-all duration-75 ${theme.progressBar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
