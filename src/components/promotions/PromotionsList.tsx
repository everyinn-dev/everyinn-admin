"use client";

import React, { useState } from "react";
import { Promotion, PromotionCategory, PromotionBadgeColor } from "@/types/promotions";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

interface PromotionsListProps {
  promotions: Promotion[];
  categories: PromotionCategory[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (promotion: Promotion) => void;
  onCreateNew: () => void;
}

const BADGE_COLOR_STYLES: Record<PromotionBadgeColor, { bg: string; text: string; border: string }> = {
  purple: { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  sky: { bg: "bg-sky-50", text: "text-sky-800", border: "border-sky-200" },
  rose: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-800", border: "border-indigo-200" },
};

export const PromotionsList: React.FC<PromotionsListProps> = ({
  promotions,
  categories,
  loading,
  onRefresh,
  onEdit,
  onCreateNew,
}) => {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "expired" | "inactive">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter promotions
  const filteredPromotions = promotions.filter((p) => {
    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(term);
      const matchCode = p.code ? p.code.toLowerCase().includes(term) : false;
      const matchDesc = p.description ? p.description.toLowerCase().includes(term) : false;
      if (!matchName && !matchCode && !matchDesc) return false;
    }

    // Category
    if (selectedCategory !== "all" && p.category_id !== selectedCategory) {
      return false;
    }

    // Status
    const isExpired = p.end_date && p.end_date < todayStr;
    if (selectedStatus === "active") {
      if (!p.is_active || isExpired) return false;
    } else if (selectedStatus === "expired") {
      if (!isExpired) return false;
    } else if (selectedStatus === "inactive") {
      if (p.is_active) return false;
    }

    return true;
  });

  const handleToggleActive = async (p: Promotion) => {
    try {
      setTogglingId(p.id);
      const newStatus = p.is_active ? 0 : 1;
      const res = await fetch(`/api/promotions/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newStatus }),
      });

      if (!res.ok) {
        throw new Error("Không thể thay đổi trạng thái.");
      }

      toast.success(
        newStatus ? `Đã kích hoạt ưu đãi "${p.name}".` : `Đã tạm dừng ưu đãi "${p.name}".`,
        "Cập nhật thành công"
      );
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Lỗi cập nhật trạng thái.", "Lỗi");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (p: Promotion) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa ưu đãi "${p.name}"?`)) {
      return;
    }

    try {
      setDeletingId(p.id);
      const res = await fetch(`/api/promotions/${p.id}`, {
        method: "DELETE",
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể xóa ưu đãi.");
      }

      toast.success("Xóa chương trình ưu đãi thành công.", "Đã xóa");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Lỗi xóa ưu đãi.", "Lỗi");
    } finally {
      setDeletingId(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Đã copy mã: ${code}`, "Copy thành công");
  };

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên ưu đãi, mã voucher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:border-emerald-600"
          >
            <option value="all">Tất cả loại ưu đãi</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:border-emerald-600"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang áp dụng</option>
            <option value="expired">Đã hết hạn</option>
            <option value="inactive">Đang tạm dừng</option>
          </select>

          {/* Add Promotion Button */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onCreateNew}
            leftIcon={<span>✨</span>}
            className="shrink-0"
          >
            Tạo Ưu Đãi
          </Button>
        </div>
      </div>

      {/* Promotions Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 font-medium">
          Đang tải danh sách ưu đãi...
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center shadow-xs space-y-3">
          <div className="text-4xl">🏷️</div>
          <p className="text-sm font-bold text-slate-800">Không tìm thấy chương trình ưu đãi nào</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Thử thay đổi bộ lọc tìm kiếm hoặc bấm nút &quot;Tạo Ưu Đãi&quot; để thiết lập chương trình khuyến mãi mới.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPromotions.map((p) => {
            const isExpired = !!(p.end_date && p.end_date < todayStr);
            const isSeasonal = !!(p.start_date || p.end_date);
            const badgeStyle =
              BADGE_COLOR_STYLES[p.category_color || "purple"] || BADGE_COLOR_STYLES.purple;

            return (
              <div
                key={p.id}
                className={`rounded-2xl bg-white border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                  !p.is_active
                    ? "opacity-65 border-slate-200 bg-slate-50/50"
                    : isExpired
                    ? "border-rose-200 bg-rose-50/20"
                    : "border-slate-200/90 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {/* Header */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    {/* Category Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                    >
                      <span>{p.category_icon || "🎁"}</span>
                      <span>{p.category_name || "Ưu đãi"}</span>
                    </span>

                    {/* Status Pill */}
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        !p.is_active
                          ? "bg-slate-100 text-slate-600 border-slate-300"
                          : isExpired
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      {!p.is_active ? "Tạm Dừng" : isExpired ? "Hết Hạn" : "Đang Chạy"}
                    </span>
                  </div>

                  {/* Title & Voucher Code */}
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2">
                      {p.name}
                    </h3>
                    {p.code && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="font-mono text-xs font-extrabold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 tracking-wider">
                          {p.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyCode(p.code!)}
                          title="Copy mã voucher"
                          className="text-slate-400 hover:text-slate-700 text-xs transition-colors p-1"
                        >
                          📋
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {p.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">{p.description}</p>
                  )}

                  {/* Discount Value Highlight */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                        Mức Chiết Khấu
                      </span>
                      <span className="text-base font-extrabold text-emerald-800 font-mono">
                        {p.discount_type === "percentage"
                          ? `Giảm ${p.discount_value}%`
                          : `Giảm ${p.discount_value.toLocaleString("vi-VN")} đ`}
                      </span>
                    </div>

                    {p.max_discount_amount && p.discount_type === "percentage" && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-medium block">Tối đa</span>
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {p.max_discount_amount.toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Conditions & Criteria */}
                  <div className="space-y-1.5 text-[11px] text-slate-600 pt-1">
                    {/* Tiers */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-slate-500">Đối tượng:</span>
                      {p.applicable_loyalty_tiers.length === 4 ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          Mọi khách hàng
                        </span>
                      ) : (
                        p.applicable_loyalty_tiers.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-bold uppercase text-[10px]"
                          >
                            {t}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Rooms & Types */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-slate-500">Phòng:</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold uppercase text-[10px]">
                        {p.applicable_room_classes.join(", ")}
                      </span>
                      {p.min_order_amount > 0 && (
                        <span className="text-slate-400">
                          • Đơn từ {p.min_order_amount.toLocaleString("vi-VN")}đ
                        </span>
                      )}
                    </div>

                    {/* Validity Period */}
                    <div className="flex items-center gap-1.5 pt-1 text-slate-600 font-medium">
                      <span>🗓️</span>
                      {isSeasonal ? (
                        <span>
                          {p.start_date || "Ngay"} ➔ {p.end_date || "Vô thời hạn"}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Áp dụng quanh năm</span>
                      )}
                    </div>

                    {/* Usage Count */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500 font-mono">
                      <span>Đã dùng: {p.used_count} lượt</span>
                      {p.usage_limit && <span>Giới hạn: {p.usage_limit}</span>}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(p)}
                    disabled={togglingId === p.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      p.is_active
                        ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        : "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
                    }`}
                  >
                    {p.is_active ? "Tạm Dừng" : "Kích Hoạt"}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(p)}
                      className="text-xs font-bold text-slate-700"
                    >
                      ✏️ Sửa
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      disabled={deletingId === p.id}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 text-xs transition-colors"
                      title="Xóa ưu đãi"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
