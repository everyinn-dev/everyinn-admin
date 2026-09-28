"use client";

import React, { useState } from "react";
import { PromotionCategory, PromotionBadgeColor } from "@/types/promotions";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

interface CategoriesListProps {
  categories: PromotionCategory[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (category: PromotionCategory) => void;
  onCreateNew: () => void;
}

const BADGE_COLOR_STYLES: Record<PromotionBadgeColor, { bg: string; text: string; border: string }> = {
  purple: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
  amber: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  sky: { bg: "bg-sky-100", text: "text-sky-800", border: "border-sky-300" },
  rose: { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300" },
  indigo: { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300" },
};

export const CategoriesList: React.FC<CategoriesListProps> = ({
  categories,
  loading,
  onRefresh,
  onEdit,
  onCreateNew,
}) => {
  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (category: PromotionCategory) => {
    if (category.promo_count && category.promo_count > 0) {
      toast.warning(
        `Không thể xóa loại ưu đãi này vì đang có ${category.promo_count} chương trình ưu đãi gắn với nó.`,
        "Không thể xóa"
      );
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục loại ưu đãi "${category.name}"?`)) {
      return;
    }

    try {
      setDeletingId(category.id);
      const res = await fetch(`/api/promotions/categories/${category.id}`, {
        method: "DELETE",
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể xóa danh mục.");
      }

      toast.success("Xóa loại ưu đãi thành công.", "Đã xóa");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Lỗi xóa loại ưu đãi.", "Lỗi");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">Danh Mục Phân Loại Ưu Đãi</h2>
          <p className="text-xs text-slate-500">
            Quản lý các nhóm ưu đãi động (Theo Mùa / Dịp Lễ, Hạng Thành Viên, Flash Deal, Đối tác...)
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onCreateNew}
          leftIcon={<span>➕</span>}
        >
          Thêm Loại Ưu Đãi
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 font-medium">
          Đang tải danh mục loại ưu đãi...
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center shadow-xs">
          <p className="text-xs text-slate-500">Chưa có danh mục loại ưu đãi nào.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => {
            const badgeStyle =
              BADGE_COLOR_STYLES[c.badge_color || "purple"] || BADGE_COLOR_STYLES.purple;

            return (
              <div
                key={c.id}
                className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-3xl p-2 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                      {c.icon}
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                    >
                      {c.code}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{c.name}</h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {c.description || "Không có mô tả."}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">
                    <strong className="text-slate-800 font-mono font-bold">
                      {c.promo_count || 0}
                    </strong>{" "}
                    ưu đãi trực thuộc
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(c)}
                      className="text-xs font-bold text-slate-700"
                    >
                      ✏️ Sửa
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      disabled={deletingId === c.id || (c.promo_count || 0) > 0}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        (c.promo_count || 0) > 0
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-rose-500 hover:bg-rose-50"
                      }`}
                      title={(c.promo_count || 0) > 0 ? "Không thể xóa vì có ưu đãi thuộc danh mục" : "Xóa"}
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
