import React from "react";
import { BookingStatus, BookingType, LoyaltyTier, RoomClass } from "@/types";

interface BadgeProps {
  children?: React.ReactNode;
  variant?: "default" | "hourly" | "overnight" | "dayuse" | "haven" | "signature" | "tier" | "status";
  type?: BookingType;
  roomClass?: RoomClass;
  tier?: LoyaltyTier;
  status?: BookingStatus;
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant: _variant = "default",
  type,
  roomClass,
  tier,
  status,
  size = "sm",
  className = "",
}) => {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-semibold";

  // Booking Type badge
  if (type) {
    switch (type) {
      case "hourly":
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-semibold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 ${sizeClass} ${className}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            {children || "Theo Giờ"}
          </span>
        );
      case "overnight":
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-semibold rounded-md bg-indigo-50 text-indigo-800 border border-indigo-300 ${sizeClass} ${className}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
            {children || "Qua Đêm"}
          </span>
        );
      case "dayuse":
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-semibold rounded-md bg-amber-50 text-amber-900 border border-amber-300 ${sizeClass} ${className}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            {children || "Theo Ngày"}
          </span>
        );
      case "custom":
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-semibold rounded-md bg-fuchsia-50 text-fuchsia-900 border border-fuchsia-300 ${sizeClass} ${className}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-600"></span>
            {children || "Tuỳ Chỉnh"}
          </span>
        );
    }
  }

  // Room Class badge
  if (roomClass) {
    if (roomClass === "signature") {
      return (
        <span
          className={`inline-flex items-center font-bold rounded-md bg-purple-50 text-purple-800 border border-purple-200 ${sizeClass} ${className}`}
        >
          Signature
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center font-bold rounded-md bg-sky-50 text-sky-800 border border-sky-200 ${sizeClass} ${className}`}
      >
        Haven
      </span>
    );
  }

  // Loyalty Tier badge
  if (tier) {
    const tierStyles: Record<LoyaltyTier, { label: string; style: string }> = {
      gold: {
        label: "🥇 Gold",
        style: "bg-amber-100 text-amber-950 border-amber-300 shadow-2xs font-bold",
      },
      silver: {
        label: "🥈 Silver",
        style: "bg-slate-100 text-slate-800 border-slate-300 font-semibold",
      },
      bronze: {
        label: "🥉 Bronze",
        style: "bg-orange-50 text-orange-900 border-orange-300 font-semibold",
      },
      new: {
        label: "Khách mới",
        style: "bg-slate-100 text-slate-600 border-slate-300 font-medium",
      },
    };
    const t = tierStyles[tier];
    return (
      <span className={`inline-flex items-center rounded-md border ${t.style} ${sizeClass} ${className}`}>
        {children || t.label}
      </span>
    );
  }

  // Booking Status badge
  if (status) {
    const statusStyles: Record<BookingStatus, { label: string; style: string }> = {
      confirmed: {
        label: "Đã xác nhận",
        style: "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold",
      },
      pending: {
        label: "Chờ xử lý",
        style: "bg-amber-50 text-amber-900 border-amber-300 font-semibold",
      },
      holding: {
        label: "Đang giữ",
        style: "bg-blue-50 text-blue-800 border-blue-300 font-semibold",
      },
      cancelled: {
        label: "Đã hủy",
        style: "bg-rose-50 text-rose-800 border-rose-300 font-semibold",
      },
      no_show: {
        label: "🚫 No-Show",
        style: "bg-purple-50 text-purple-900 border-purple-300 font-bold",
      },
    };
    const s = statusStyles[status] || statusStyles.confirmed;
    return (
      <span className={`inline-flex items-center rounded-md border ${s.style} ${sizeClass} ${className}`}>
        {children || s.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClass} ${className}`}
    >
      {children}
    </span>
  );
};
