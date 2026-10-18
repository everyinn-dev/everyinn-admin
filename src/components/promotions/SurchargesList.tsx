"use client";

import React from "react";
import { SurchargeRule } from "@/types";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { clearCache, CACHE_KEY } from "@/lib/localCache";

interface SurchargesListProps {
  rules: SurchargeRule[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (rule: SurchargeRule) => void;
  onCreateNew: () => void;
}

export const SurchargesList: React.FC<SurchargesListProps> = ({
  rules,
  loading,
  onRefresh,
  onEdit,
  onCreateNew,
}) => {
  const toast = useToast();

  const handleDelete = async (rule: SurchargeRule) => {
    if (!window.confirm(`Bạn có chắc muốn xóa quy tắc phụ thu "${rule.name}"?`)) return;
    try {
      const res = await fetch(`/api/surcharges/${rule.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as any;
        throw new Error(data.error || "Không thể xóa quy tắc phụ thu.");
      }
      clearCache(CACHE_KEY.CONFIGS);
      toast.success("Đã xóa quy tắc phụ thu.", "Thành công");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi xóa quy tắc phụ thu.", "Lỗi");
    }
  };

  if (loading) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
        Đang tải danh sách quy tắc phụ thu...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">
            Cấu Hình Phụ Thu Ngày Lễ & Phụ Phí Khách Thêm (Master Data)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động bóc tách phụ thu lễ theo từng đêm lưu trú (Stay Date) và phụ phí người thứ 3+ cho hạng Signature.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={onCreateNew}>
          + Tạo Quy Tắc Phụ Thu
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                    {rule.surcharge_type === "holiday"
                      ? "🎌 Ngày Lễ"
                      : rule.surcharge_type === "extra_guest"
                      ? "👥 Khách Thêm"
                      : "⚡ Phụ Phí"}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">{rule.code}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    rule.is_active === 1
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {rule.is_active === 1 ? "Đang bật" : "Tạm tắt"}
                </span>
              </div>

              <h3 className="text-sm font-extrabold text-slate-900">{rule.name}</h3>

              <div className="text-xs font-mono font-black text-amber-800">
                {rule.calc_mode === "percentage"
                  ? `+${rule.amount}% trên giá cơ bản`
                  : `+${rule.amount.toLocaleString("vi-VN")} đ`}{" "}
                <span className="text-[11px] font-normal text-slate-500">
                  ({rule.unit_scope === "per_guest_night"
                    ? `mỗi khách > ${rule.guest_threshold} người / đêm`
                    : rule.unit_scope === "per_night"
                    ? "mỗi đêm lưu trú"
                    : "mỗi đơn"})
                </span>
              </div>

              <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                <div>
                  📅 Hiệu lực:{" "}
                  <strong>
                    {rule.start_date || rule.end_date
                      ? `${rule.start_date || "..."} → ${rule.end_date || "..."}`
                      : "Quanh năm"}
                  </strong>{" "}
                  (Ưu tiên: {rule.priority})
                </div>
                <div>
                  🏨 Hạng phòng: <strong>{rule.applicable_room_classes.join(", ").toUpperCase()}</strong>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onEdit(rule)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                ✏️ Chỉnh sửa
              </button>
              <button
                type="button"
                onClick={() => handleDelete(rule)}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700"
              >
                🗑️ Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
