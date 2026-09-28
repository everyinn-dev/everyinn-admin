"use client";

import React from "react";
import Link from "next/link";
import { GanttBookingItem, GanttRoomData } from "@/types";
import { Badge } from "../ui/Badge";

interface MobileRoomCardProps {
  room: GanttRoomData;
  currentDate: string;
  onBookingClick: (booking: GanttBookingItem) => void;
}

export const MobileRoomCard: React.FC<MobileRoomCardProps> = ({
  room,
  currentDate,
  onBookingClick,
}) => {
  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOccupiedNow = room.bookings.some((b) => {
    const now = Date.now();
    const start = new Date(b.checkinAt).getTime();
    const end = new Date(b.checkoutAt).getTime();
    return now >= start && now <= end && b.status !== "cancelled";
  });

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-3 shadow-2xs">
      {/* Room Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 font-mono font-bold text-slate-800 flex items-center justify-center text-xs shadow-2xs">
            {room.roomNumber}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">{room.name}</div>
            <div className="text-[10px] text-slate-500">Tầng {room.floor}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge roomClass={room.roomClass} size="sm" />
          {isOccupiedNow ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
              Đang có khách
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Phòng trống
            </span>
          )}
        </div>
      </div>

      {/* Bookings on this date */}
      {room.bookings.length === 0 ? (
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
          <span className="text-[11px] text-slate-500">Không có lịch đặt hôm nay</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {room.bookings.map((booking) => (
            <div
              key={booking.id}
              onClick={() => onBookingClick(booking)}
              className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2 truncate">
                <Badge type={booking.bookingType} size="sm" />
                <span className="font-bold text-slate-900 truncate">
                  {booking.guestName}
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-slate-700 text-[11px] font-medium">
                  {formatTime(booking.checkinAt)} - {formatTime(booking.checkoutAt)}
                </div>
                <div className="text-emerald-700 text-[10px] font-extrabold">
                  {Number(booking.totalPrice).toLocaleString("vi-VN")} đ
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Action */}
      <div className="pt-1 flex justify-end">
        <Link
          href={`/bookings/new?roomId=${room.id}&date=${currentDate}`}
          className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
        >
          <span>+ Đặt phòng này</span>
        </Link>
      </div>
    </div>
  );
};
