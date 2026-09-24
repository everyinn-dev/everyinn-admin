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
  variant = "default",
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
            className={`inline-flex items-center gap-1 font-medium rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 ${sizeClass} ${className}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {children || "Theo Giờ"}
          </span>
        );
      case "overnight":
        return (
          <span
            className={`inline-flex items-center gap-1 font-medium rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 ${sizeClass} ${className}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            {children || "Qua Đêm"}
          </span>
        );
      case "dayuse":
        return (
          <span
            className={`inline-flex items-center gap-1 font-medium rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 ${sizeClass} ${className}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {children || "Theo Ngày"}
          </span>
        );
    }
  }

  // Room Class badge
  if (roomClass) {
    if (roomClass === "signature") {
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 ${sizeClass} ${className}`}
        >
          Signature
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center font-medium rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 ${sizeClass} ${className}`}
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
        style: "bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-sm shadow-amber-400/10",
      },
      silver: {
        label: "🥈 Silver",
        style: "bg-slate-300/20 text-slate-200 border-slate-300/40",
      },
      bronze: {
        label: "🥉 Bronze",
        style: "bg-orange-600/20 text-orange-300 border-orange-600/40",
      },
      new: {
        label: "Khách mới",
        style: "bg-slate-700/40 text-slate-400 border-slate-700",
      },
    };
    const t = tierStyles[tier];
    return (
      <span className={`inline-flex items-center font-semibold rounded-md border ${t.style} ${sizeClass} ${className}`}>
        {children || t.label}
      </span>
    );
  }

  // Booking Status badge
  if (status) {
    const statusStyles: Record<BookingStatus, { label: string; style: string }> = {
      confirmed: {
        label: "Đã xác nhận",
        style: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      },
      pending: {
        label: "Chờ xử lý",
        style: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      },
      holding: {
        label: "Đang giữ",
        style: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      },
      cancelled: {
        label: "Đã hủy",
        style: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      },
    };
    const s = statusStyles[status] || statusStyles.confirmed;
    return (
      <span className={`inline-flex items-center font-medium rounded-md border ${s.style} ${sizeClass} ${className}`}>
        {children || s.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md bg-slate-800 text-slate-300 border border-slate-700 ${sizeClass} ${className}`}
    >
      {children}
    </span>
  );
};
