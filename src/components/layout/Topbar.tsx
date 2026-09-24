"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";

interface TopbarProps {
  staff?: {
    fullName: string;
    role: string;
    phone: string;
  } | null;
}

export const Topbar: React.FC<TopbarProps> = ({ staff }) => {
  const router = useRouter();
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDateStr(
        now.toLocaleDateString("vi-VN", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0d131f]/90 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between">
      {/* Left: Brand / Branch */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-base shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            EI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-base">
                EVERY INN
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-none">
              Chi nhánh Vạn Hạnh · Quận 10
            </p>
          </div>
        </Link>
      </div>

      {/* Middle: Live Clock */}
      <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-medium text-slate-300">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-mono text-emerald-300 font-semibold">{timeStr}</span>
        <span className="text-slate-600">|</span>
        <span className="capitalize">{dateStr}</span>
      </div>

      {/* Right: Actions & Staff Profile */}
      <div className="flex items-center gap-3">
        <Link href="/bookings/new">
          <Button
            size="sm"
            variant="primary"
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Tạo Đặt Phòng
          </Button>
        </Link>

        {staff && (
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-slate-200">{staff.fullName}</div>
              <div className="text-[10px] text-slate-400 capitalize">
                {staff.role === "manager" ? "Quản lý" : "Lễ tân"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Đăng xuất"
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/30 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
