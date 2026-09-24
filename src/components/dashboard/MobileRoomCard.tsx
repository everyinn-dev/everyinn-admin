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
    <div className="rounded-xl bg-[#0d131f] border border-slate-800/80 p-3.5 space-y-3 shadow-md">
      {/* Room Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-slate-100 flex items-center justify-center text-xs">
            {room.roomNumber}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">{room.name}</div>
            <div className="text-[10px] text-slate-400">Tầng {room.floor}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge roomClass={room.roomClass} size="sm" />
          {isOccupiedNow ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Đang có khách
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Phòng trống
            </span>
          )}
        </div>
      </div>

      {/* Bookings on this date */}
      {room.bookings.length === 0 ? (
        <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/50 text-center">
          <span className="text-[11px] text-slate-400">Không có lịch đặt hôm nay</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {room.bookings.map((booking) => (
            <div
              key={booking.id}
              onClick={() => onBookingClick(booking)}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2 truncate">
                <Badge type={booking.bookingType} size="sm" />
                <span className="font-semibold text-slate-200 truncate">
                  {booking.guestName}
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-slate-300 text-[11px]">
                  {formatTime(booking.checkinAt)} - {formatTime(booking.checkoutAt)}
                </div>
                <div className="text-emerald-400 text-[10px] font-bold">
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
          className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
        >
          <span>+ Đặt phòng này</span>
        </Link>
      </div>
    </div>
  );
};
