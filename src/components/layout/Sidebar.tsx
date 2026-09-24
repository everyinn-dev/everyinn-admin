"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Bảng Phòng (Gantt)",
      href: "/dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      label: "Tạo Đặt Phòng",
      href: "/bookings/new",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      label: "Danh Sách Đặt Phòng",
      href: "/bookings",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#0d131f]/70 backdrop-blur-md flex flex-col justify-between p-4 shrink-0 hidden lg:flex">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Nghiệp vụ lễ tân
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <span className={isActive ? "text-emerald-400" : "text-slate-400"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Room Types Quick Legend */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Phân loại phòng
          </p>
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                <span>Haven (10P)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">101, 102...</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                <span>Signature (5P)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">x03</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
        <div className="flex items-center justify-between">
          <span>Every Inn Admin</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
            v1.0 MVP
          </span>
        </div>
        <p className="mt-1 text-[10px]">Cloudflare D1 & Worker</p>
      </div>
    </aside>
  );
};
