"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";
import { clearAllCache } from "@/lib/localCache";

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
      clearAllCache(); // Purge all localStorage cache on logout
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
      clearAllCache();
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between">
      {/* Left: Brand / Branch */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-extrabold text-base shadow-sm group-hover:scale-105 transition-transform">
            EI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-slate-900 text-base">
                EVERY INN
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-none">
              Chi nhánh Phan Xích Long · Cầu Kiệu (Phú Nhuận)
            </p>
          </div>
        </Link>
      </div>

      {/* Middle: Live Clock */}
      <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-medium text-slate-700">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-mono text-emerald-800 font-bold">{timeStr}</span>
        <span className="text-slate-300">|</span>
        <span className="capitalize text-slate-600">{dateStr}</span>
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
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-slate-800">{staff.fullName}</div>
              <div className="text-[10px] text-slate-500 capitalize">
                {staff.role === "manager" ? "Quản lý" : "Lễ tân"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Đăng xuất"
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 flex items-center justify-center transition-colors cursor-pointer"
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
