import React from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { BookingsListClient } from "./_components/BookingsListClient";

export const metadata = {
  title: "Danh Sách Đặt Phòng | Every Inn Admin",
  description: "Quản lý và tra cứu toàn bộ danh sách đặt phòng tại Every Inn Phan Xích Long",
};

export default function BookingsListPage() {
  return (
    <AdminShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <React.Suspense fallback={<div className="py-24 text-center text-sm text-slate-500 font-semibold">Đang tải...</div>}>
          <BookingsListClient />
        </React.Suspense>
      </div>
    </AdminShell>
  );
}
