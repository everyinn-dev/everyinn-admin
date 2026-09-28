"use client";

import React from "react";
import { BookingType } from "@/types";

interface BookingTypeTabsProps {
  selectedType: BookingType;
  onChangeType: (type: BookingType) => void;
}

export const BookingTypeTabs: React.FC<BookingTypeTabsProps> = ({
  selectedType,
  onChangeType,
}) => {
  const types: { id: BookingType; label: string; icon: string; desc: string }[] = [
    {
      id: "hourly",
      label: "Theo Giờ",
      icon: "⏱️",
      desc: "Combo 3h, 6h + phụ trội",
    },
    {
      id: "overnight",
      label: "Qua Đêm",
      icon: "🌙",
      desc: "21h-24h đến 9h-12h trưa",
    },
    {
      id: "dayuse",
      label: "Theo Ngày",
      icon: "📅",
      desc: "Nhận 15h - Trả 12h trưa",
    },
    {
      id: "custom",
      label: "Tuỳ Chỉnh",
      icon: "⚙️",
      desc: "Tự chọn giờ & tự nhập giá",
    },
  ];

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase">
        Hình thức đặt phòng <span className="text-rose-500">*</span>
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {types.map((t) => {
          const isSelected = selectedType === t.id;
          const isCustom = t.id === "custom";

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeType(t.id)}
              className={`p-3 rounded-xl border text-left transition-all relative select-none cursor-pointer ${
                isSelected
                  ? isCustom
                    ? "bg-fuchsia-50 border-fuchsia-500 shadow-xs ring-2 ring-fuchsia-500/20"
                    : "bg-emerald-50 border-emerald-600 shadow-xs ring-2 ring-emerald-600/20"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base">{t.icon}</span>
                <span
                  className={`text-sm font-bold truncate ${
                    isSelected
                      ? isCustom
                        ? "text-fuchsia-900"
                        : "text-emerald-900"
                      : "text-slate-800"
                  }`}
                >
                  {t.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 font-medium">
                {t.desc}
              </p>
              {isSelected && (
                <div
                  className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                    isCustom
                      ? "bg-fuchsia-600 shadow-[0_0_6px_#c026d3]"
                      : "bg-emerald-600 shadow-[0_0_6px_#059669]"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
