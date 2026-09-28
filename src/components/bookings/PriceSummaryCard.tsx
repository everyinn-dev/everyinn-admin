"use client";

import React from "react";
import { PricingBreakdown } from "@/lib/pricing";
import { Room } from "@/types";

interface PriceSummaryCardProps {
  pricing: PricingBreakdown;
  selectedRoom?: Room | null;
}

export const PriceSummaryCard: React.FC<PriceSummaryCardProps> = ({
  pricing,
  selectedRoom,
}) => {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-50/60 via-slate-50 to-white border border-emerald-200/90 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Tóm tắt chi phí
          </span>
          <span className="text-sm font-bold text-slate-900">
            {selectedRoom ? `${selectedRoom.name} (${selectedRoom.room_class.toUpperCase()})` : "Chưa chọn phòng"}
          </span>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold">
          {pricing.comboLabel}
        </span>
      </div>

      {/* Itemized lines */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Giá gốc ({pricing.durationLabel}):</span>
          <span className="font-mono font-bold text-slate-900">
            {pricing.basePrice.toLocaleString("vi-VN")} đ
          </span>
        </div>

        {pricing.totalExtraFee > 0 && (
          <div className="flex justify-between text-amber-800 font-semibold">
            <span>
              Phụ phí giờ thêm ({pricing.extraHours}h × {pricing.extraHourFee.toLocaleString("vi-VN")}đ):
            </span>
            <span className="font-mono font-bold text-amber-900">
              +{pricing.totalExtraFee.toLocaleString("vi-VN")} đ
            </span>
          </div>
        )}

        {pricing.discountAmount > 0 && (
          <div className="flex justify-between text-rose-700 font-semibold">
            <span>Giảm trừ:</span>
            <span className="font-mono font-bold text-rose-800">
              -{pricing.discountAmount.toLocaleString("vi-VN")} đ
            </span>
          </div>
        )}
      </div>

      {/* Total Section */}
      <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
        <div>
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">TỔNG CỘNG</span>
          <span className="text-[11px] text-emerald-700 font-medium">Thu tiền trực tiếp tại quầy</span>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tracking-tight">
            {pricing.totalPrice.toLocaleString("vi-VN")} đ
          </div>
        </div>
      </div>
    </div>
  );
};
