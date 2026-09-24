"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { Spinner } from "../ui/Spinner";

interface AdminShellProps {
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [staff, setStaff] = useState<{ fullName: string; role: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If on login page, don't verify shell
    if (pathname === "/login") {
      setLoading(false);
      return;
    }

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = (await res.json()) as any;
        if (data.authenticated && data.staff) {
          setStaff(data.staff);
        } else {
          router.push("/login");
        }
      } catch (e) {
        console.error(e);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [pathname, router]);

  if (pathname === "/login") {
    return <main className="min-h-screen">{children}</main>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải Every Inn Admin...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17]">
      <Topbar staff={staff} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-[#0d131f]/95 backdrop-blur-md border-t border-slate-800 z-40 flex items-center justify-around px-2">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            pathname === "/dashboard" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span>Bảng Phòng</span>
        </Link>
        <Link
          href="/bookings/new"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            pathname === "/bookings/new" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Tạo Đặt</span>
        </Link>
        <Link
          href="/bookings"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            pathname === "/bookings" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          <span>Danh Sách</span>
        </Link>
      </nav>
    </div>
  );
};
