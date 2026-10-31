"use client";

import React from "react";
import type { Room } from "@/types";
import type { CoreAvailabilityPriceDto } from "@/lib/coreMappers";

export interface AvailableRoomCardItem {
  room: Room;
  available: boolean;
  reasons: Array<{ code: string; message: string }>;
  price: CoreAvailabilityPriceDto | null;
}

interface AvailableRoomCardProps {
  item: AvailableRoomCardItem;
  checkinAt: Date;
  checkoutAt: Date;
  numGuests: number;
  holdingRoomId: string | null;
  onSelectRoom: (item: AvailableRoomCardItem) => void;
}

function formatShortTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} (${pad(d.getDate())}/${pad(d.getMonth() + 1)})`;
}

export const AvailableRoomCard: React.FC<AvailableRoomCardProps> = ({
  item,
  checkinAt,
  checkoutAt,
  numGuests,
  holdingRoomId,
  onSelectRoom,
}) => {
  const { room, price } = item;
  const isSignature = room.room_class === "signature";
  const isHoldingThis = holdingRoomId === room.id;
  const isAnyHolding = holdingRoomId !== null;

  return (
    <div
      className={`rounded-2xl bg-white border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
        isSignature
          ? "border-purple-200/90 hover:border-purple-400"
          : "border-sky-200/90 hover:border-sky-400"
      }`}
    >
      {/* Top Room Header */}
      <div
        className={`p-4 border-b ${
          isSignature
            ? "bg-gradient-to-r from-purple-50/80 via-indigo-50/40 to-white border-purple-100"
            : "bg-gradient-to-r from-sky-50/80 via-emerald-50/30 to-white border-sky-100"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                  isSignature
                    ? "bg-purple-100 text-purple-900 border-purple-300"
                    : "bg-sky-100 text-sky-900 border-sky-300"
                }`}
              >
                {isSignature ? "✨ SIGNATURE" : "🌿 HAVEN"}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Tầng {room.floor}
                {room.area_sqm ? ` • ${room.area_sqm}m²` : ""}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mt-1">
              {room.name}
            </h3>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold shrink-0 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>Trống</span>
          </span>
        </div>

        {/* Capacity & Stay Time */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-medium">
            👥 Tối đa {room.max_guests} khách (Đang chọn: {numGuests})
          </span>
          {price && (
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold text-slate-800">
              🏷️ {price.comboLabel} ({price.durationLabel})
            </span>
          )}
        </div>
      </div>

      {/* Price Breakdown Body */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="text-xs text-slate-600 flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
            <span className="font-medium text-slate-500">Khung giờ:</span>
            <span className="font-mono font-bold text-slate-800 text-[11px]">
              {formatShortTime(checkinAt)} → {formatShortTime(checkoutAt)}
            </span>
          </div>

          {price ? (
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Giá niêm yết cơ bản:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {price.basePrice.toLocaleString("vi-VN")} đ
                </span>
              </div>

              {price.holidaySurcharge > 0 && (
                <div className="flex items-center justify-between text-amber-800">
                  <span>+ Phụ thu Lễ/Tết:</span>
                  <span className="font-mono font-semibold">
                    +{price.holidaySurcharge.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              )}

              {price.extraFee > 0 && (
                <div className="flex items-center justify-between text-amber-800">
                  <span>+ Phụ phí thêm giờ:</span>
                  <span className="font-mono font-semibold">
                    +{price.extraFee.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              )}

              {price.extraGuestFee > 0 && (
                <div className="flex items-center justify-between text-indigo-800">
                  <span>+ Phụ thu khách thêm:</span>
                  <span className="font-mono font-semibold">
                    +{price.extraGuestFee.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-rose-600 py-2">
              Không thể tính giá cho khung giờ này.
            </div>
          )}
        </div>

        {/* Total Price & Select CTA */}
        <div className="pt-3 border-t border-slate-100 space-y-3 mt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Tổng giá niêm yết
            </span>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-700 tracking-tight">
              {price ? `${price.subtotal.toLocaleString("vi-VN")} đ` : "—"}
            </span>
          </div>

          <button
            type="button"
            disabled={!price || isAnyHolding}
            onClick={() => onSelectRoom(item)}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 text-white font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            {isHoldingThis ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Đang giữ phòng 15 phút...</span>
              </>
            ) : (
              <>
                <span>🔒</span>
                <span>Chọn phòng này (Giữ 15 phút)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

