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
    <div className="rounded-2xl bg-gradient-to-br from-[#121927] to-[#182337] border border-slate-700/80 p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Tóm tắt chi phí
          </span>
          <span className="text-sm font-semibold text-slate-200">
            {selectedRoom ? `${selectedRoom.name} (${selectedRoom.room_class.toUpperCase()})` : "Chưa chọn phòng"}
          </span>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
          {pricing.comboLabel}
        </span>
      </div>

      {/* Itemized lines */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-slate-300">
          <span>Giá gốc ({pricing.durationLabel}):</span>
          <span className="font-mono font-medium text-slate-100">
            {pricing.basePrice.toLocaleString("vi-VN")} đ
          </span>
        </div>

        {pricing.totalExtraFee > 0 && (
          <div className="flex justify-between text-amber-300 font-medium">
            <span>
              Phụ phí giờ thêm ({pricing.extraHours}h × {pricing.extraHourFee.toLocaleString("vi-VN")}đ):
            </span>
            <span className="font-mono">
              +{pricing.totalExtraFee.toLocaleString("vi-VN")} đ
            </span>
          </div>
        )}

        {pricing.discountAmount > 0 && (
          <div className="flex justify-between text-rose-300 font-medium">
            <span>Giảm trừ:</span>
            <span className="font-mono">
              -{pricing.discountAmount.toLocaleString("vi-VN")} đ
            </span>
          </div>
        )}
      </div>

      {/* Total Section */}
      <div className="pt-3 border-t border-slate-700/80 flex items-baseline justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium block">TỔNG CỘNG</span>
          <span className="text-[11px] text-emerald-400/80">Thu tiền trực tiếp tại quầy</span>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
            {pricing.totalPrice.toLocaleString("vi-VN")} đ
          </div>
        </div>
      </div>
    </div>
  );
};
