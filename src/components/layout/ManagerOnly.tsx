"use client";

import React from "react";
import Link from "next/link";
import { useAdminStaff } from "./AdminShell";

interface ManagerOnlyProps {
  featureName?: string;
  children: React.ReactNode;
}

/**
 * Renders children only when the signed-in staff member is a manager.
 * Must be placed inside <AdminShell> so staff identity is already resolved before rendering.
 */
export const ManagerOnly: React.FC<ManagerOnlyProps> = ({ featureName = "tính năng này", children }) => {
  const staff = useAdminStaff();

  if (staff?.role === "manager") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 mx-auto flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-extrabold text-slate-900">Không có quyền truy cập</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Chỉ quản lý (manager) được phép truy cập {featureName}. Nếu cần kiểm tra mã cửa cho khách, bạn có thể mở trực tiếp nút{" "}
            <strong className="text-emerald-800">Mã cửa</strong> trên Bảng Phòng.
          </p>
        </div>
        <div className="pt-1 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
          >
            Quay lại Bảng Phòng (Gantt)
          </Link>
        </div>
      </div>
    </div>
  );
};
