"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { Spinner } from "../ui/Spinner";
import { DepositReminderModal } from "../bookings/DepositReminderModal";
import {
  getCachedStaffIdentity,
  setCachedStaffIdentity,
  clearAllCache,
  onSessionExpired,
  dispatchSessionExpired,
  StaffIdentity,
} from "@/lib/localCache";

const AdminStaffContext = createContext<StaffIdentity | null>(null);

/** Reads the authenticated staff identity inside AdminShell (falls back to client cache if rendered standalone). */
export function useAdminStaff(): StaffIdentity | null {
  return useContext(AdminStaffContext) ?? getCachedStaffIdentity();
}

interface AdminShellProps {
  children: React.ReactNode;
  /** Full-screen workspace (e.g. Vận hành AI): keeps the auth guard, hides topbar, sidebar and bottom nav. */
  bare?: boolean;
}

const AUTH_VERIFY_COOLDOWN_MS = 15 * 60 * 1000; // 15 min cooldown for background /api/auth/me checks
let lastAuthVerifiedMs = 0;

export const AdminShell: React.FC<AdminShellProps> = ({ children, bare = false }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffIdentity | null>(null);
  const [loading, setLoading] = useState(() => pathname !== "/login");

  // 1. Listen for global session expiration (triggered by 401s from any API or watchdog)
  useEffect(() => {
    const unsubscribe = onSessionExpired((reason) => {
      lastAuthVerifiedMs = 0;
      clearAllCache();
      router.push(`/login?reason=${reason}`);
    });
    return unsubscribe;
  }, [router]);

  // 2. Proactive watchdog: auto-logout timer when session expires
  useEffect(() => {
    if (!staff?.expiresAt) return;

    const remainingMs = staff.expiresAt - Date.now();
    if (remainingMs <= 0) {
      dispatchSessionExpired("expired");
      return;
    }

    // Schedule auto-logout when session duration elapses
    const timer = setTimeout(() => {
      dispatchSessionExpired("expired");
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [staff?.expiresAt]);

  // 3. Auth verification on mount / pathname change
  useEffect(() => {
    // If on login page, don't verify shell
    if (pathname === "/login") {
      return;
    }

    async function checkAuth() {
      // Fast-path: restore staff identity from localStorage cache
      const cached = getCachedStaffIdentity();
      if (cached) {
        // If expired according to timestamp, trigger immediate logout
        if (cached.expiresAt && Date.now() >= cached.expiresAt) {
          dispatchSessionExpired("expired");
          return;
        }

        setStaff(cached);
        setLoading(false);

        // Silently verify in background to ensure JWT cookie is still valid (throttled to 15 mins)
        const now = Date.now();
        if (now - lastAuthVerifiedMs >= AUTH_VERIFY_COOLDOWN_MS) {
          lastAuthVerifiedMs = now;
          fetch("/api/auth/me")
            .then(async (res) => {
              if (!res.ok) {
                dispatchSessionExpired("unauthorized");
              } else {
                const data = (await res.json()) as any;
                if (data.authenticated && data.staff) {
                  const refreshedStaff: StaffIdentity = {
                    id: data.staff.id ?? 0,
                    phone: data.staff.phone,
                    fullName: data.staff.fullName,
                    role: data.staff.role,
                    expiresAt: data.staff.expiresAt || (Date.now() + 86400 * 1000),
                  };
                  setStaff(refreshedStaff);
                  setCachedStaffIdentity(refreshedStaff);
                }
              }
            })
            .catch(() => {});
        }
        return;
      }

      // Cache miss: verify with server
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          dispatchSessionExpired("unauthorized");
          return;
        }
        const data = (await res.json()) as any;
        if (data.authenticated && data.staff) {
          lastAuthVerifiedMs = Date.now();
          const freshStaff: StaffIdentity = {
            id: data.staff.id ?? 0,
            phone: data.staff.phone,
            fullName: data.staff.fullName,
            role: data.staff.role,
            expiresAt: data.staff.expiresAt || (Date.now() + 86400 * 1000),
          };
          setStaff(freshStaff);
          setCachedStaffIdentity(freshStaff);
        } else {
          dispatchSessionExpired("unauthorized");
        }
      } catch (e) {
        console.error("Auth check failed:", e);
        dispatchSessionExpired("network_error");
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-600 font-medium">Đang tải Every Inn Admin...</p>
      </div>
    );
  }

  if (bare) {
    return (
      <AdminStaffContext.Provider value={staff}>
        <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>
      </AdminStaffContext.Provider>
    );
  }

  return (
    <AdminStaffContext.Provider value={staff}>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <Topbar staff={staff} />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar isManager={staff?.role === "manager"} />
          <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</main>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 flex items-center justify-around px-2 shadow-xs">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
              pathname === "/dashboard" ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-800"
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
            href="/bookings/search"
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
              pathname === "/bookings/search" ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span>Tìm Phòng</span>
          </Link>
          <Link
            href="/bookings/new"
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
              pathname === "/bookings/new" ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-800"
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
              pathname === "/bookings" ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-800"
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
          {staff?.role === "manager" && (
            <Link
              href="/agent-inbox"
              className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
                pathname.startsWith("/agent") ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>AI</span>
            </Link>
          )}
          <Link
            href="/promotions"
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
              pathname.startsWith("/promotions") ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <span>Ưu Đãi</span>
          </Link>
          {staff?.role === "manager" && (
            <Link
              href="/calendar"
              className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
                pathname.startsWith("/calendar") ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Lịch</span>
            </Link>
          )}
          {staff?.role === "manager" && (
            <Link
              href="/finance"
              className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
                pathname.startsWith("/finance") ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Tài Chính</span>
            </Link>
          )}
        </nav>

        {/* Global Automated Deposit Reminder Popup Modal */}
        <DepositReminderModal />
      </div>
    </AdminStaffContext.Provider>
  );
};
