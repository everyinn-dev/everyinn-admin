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
      <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase">
        Hình thức đặt phòng <span className="text-rose-400">*</span>
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
                    ? "bg-fuchsia-500/15 border-fuchsia-500/60 shadow-lg shadow-fuchsia-500/10 ring-1 ring-fuchsia-500"
                    : "bg-emerald-500/15 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base">{t.icon}</span>
                <span
                  className={`text-sm font-bold truncate ${
                    isSelected
                      ? isCustom
                        ? "text-fuchsia-300"
                        : "text-emerald-300"
                      : "text-slate-200"
                  }`}
                >
                  {t.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                {t.desc}
              </p>
              {isSelected && (
                <div
                  className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                    isCustom
                      ? "bg-fuchsia-400 shadow-[0_0_6px_#c026d3]"
                      : "bg-emerald-400 shadow-[0_0_6px_#10b981]"
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
