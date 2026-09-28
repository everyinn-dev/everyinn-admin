"use client";

import React from "react";
import { Booking } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { BookingsTableHeader } from "./BookingsTableHeader";

interface BookingsTableProps {
  bookings: Booking[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (column: string) => void;
  onSelectBooking: (booking: Booking) => void;
}

export const BookingsTable: React.FC<BookingsTableProps> = ({
  bookings,
  sortBy,
  sortDir,
  onSort,
  onSelectBooking,
}) => {
  const formatDateTimeParts = (iso: string) => {
    if (!iso) return { time: "-", date: "" };
    const d = new Date(iso);
    const time = d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const date = d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return { time, date };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <BookingsTableHeader sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
        <tbody className="divide-y divide-slate-200">
          {bookings.map((b) => {
            const checkin = formatDateTimeParts(b.checkin_at);
            const checkout = formatDateTimeParts(b.checkout_at);
            const created = formatDateTimeParts(b.created_at);
            const updated = formatDateTimeParts(b.updated_at);

            return (
              <tr
                key={b.id}
                onClick={() => onSelectBooking(b)}
                className="hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                {/* 1. Mã đặt */}
                <td className="py-3 px-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                  #{b.id}
                </td>

                {/* 2. Instagram */}
                <td className="py-3 px-3 whitespace-nowrap">
                  {b.instagram ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200 text-[11px] font-medium max-w-[140px] truncate">
                      <span>📸</span>
                      <span className="truncate">@{b.instagram.replace(/^@/, "")}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px] pl-1">-</span>
                  )}
                </td>

                {/* 3. Facebook */}
                <td className="py-3 px-3 whitespace-nowrap">
                  {b.facebook ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium max-w-[140px] truncate">
                      <span className="font-bold text-blue-600">f</span>
                      <span className="truncate">{b.facebook}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px] pl-1">-</span>
                  )}
                </td>

                {/* 4. Khách hàng: Chỉ Tên + SĐT */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {b.member_name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {b.member_phone}
                  </div>
                </td>

                {/* 5. Phòng */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                    {b.room_name || b.room_id}
                  </span>
                </td>

                {/* 6. Loại hình */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <Badge type={b.booking_type} size="sm" />
                </td>

                {/* 7. Thời gian check-in */}
                <td className="py-3 px-3 font-mono whitespace-nowrap">
                  <div className="text-slate-900 font-semibold">{checkin.time}</div>
                  <div className="text-[11px] text-slate-500">{checkin.date}</div>
                </td>

                {/* 8. Thời gian check-out */}
                <td className="py-3 px-3 font-mono whitespace-nowrap">
                  <div className="text-slate-900 font-semibold">{checkout.time}</div>
                  <div className="text-[11px] text-slate-500">{checkout.date}</div>
                </td>

                {/* 9. Trạng thái */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="space-y-0.5">
                    <Badge status={b.status} size="sm" />
                    {b.status === "no_show" && b.refund_amount && b.refund_amount > 0 ? (
                      <div className="text-[10px] text-purple-700 font-mono">
                        Hoàn {Number(b.refund_amount).toLocaleString("vi-VN")}đ
                      </div>
                    ) : null}
                  </div>
                </td>

                {/* 10. Tổng tiền */}
                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap text-sm">
                  {Number(b.total_price || 0).toLocaleString("vi-VN")} đ
                </td>

                {/* 10. Người tạo */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <span className="text-slate-700 font-medium text-[11px]">
                    {b.created_by_staff_name || "Hệ thống"}
                  </span>
                </td>

                {/* 11. Ngày tạo */}
                <td className="py-3 px-3 font-mono whitespace-nowrap text-[11px] text-slate-500">
                  <div>{created.time}</div>
                  <div className="text-slate-400">{created.date}</div>
                </td>

                {/* 12. Lần sửa (Mod) */}
                <td className="py-3 px-3 whitespace-nowrap">
                  {b.mod_no > 0 ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-50 text-amber-800 border border-amber-200">
                          ✏️ {b.mod_no} lần
                        </span>
                        <span className="text-[11px] text-slate-700 font-medium truncate max-w-[110px]" title={b.updated_by_staff_name || "Nhân viên"}>
                          {b.updated_by_staff_name || "Nhân viên"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {updated.time} {updated.date}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px] pl-1">0 (Gốc)</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
