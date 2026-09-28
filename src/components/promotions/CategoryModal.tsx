"use client";

import React, { useState, useEffect } from "react";
import { PromotionCategory, PromotionBadgeColor } from "@/types/promotions";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: PromotionCategory | null;
  onSaved: () => void;
}

const COLOR_OPTIONS: { id: PromotionBadgeColor; label: string; bg: string; border: string; text: string }[] = [
  { id: "purple", label: "Tím (Thành viên)", bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-800" },
  { id: "amber", label: "Vàng Hổ Phách (Mùa/Dịp lễ)", bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-800" },
  { id: "emerald", label: "Xanh Lục (Quà tặng/Kênh)", bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-800" },
  { id: "sky", label: "Xanh Dương (Flash Deal)", bg: "bg-sky-100", border: "border-sky-300", text: "text-sky-800" },
  { id: "rose", label: "Hồng Đỏ (Đặc biệt)", bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-800" },
  { id: "indigo", label: "Chàm (Đối tác)", bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-800" },
];

const EMOJI_PRESETS = ["🍂", "👑", "🎁", "⚡", "🔥", "🏖️", "✨", "🎉", "🏷️", "💎"];

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  category,
  onSaved,
}) => {
  const toast = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🎁");
  const [badgeColor, setBadgeColor] = useState<PromotionBadgeColor>("purple");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name || "");
      setCode(category.code || "");
      setDescription(category.description || "");
      setIcon(category.icon || "🎁");
      setBadgeColor(category.badge_color || "purple");
      setSortOrder(category.sort_order || 0);
      setIsActive(category.is_active === 1);
    } else {
      setName("");
      setCode("");
      setDescription("");
      setIcon("🎁");
      setBadgeColor("purple");
      setSortOrder(0);
      setIsActive(true);
    }
  }, [category, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning("Vui lòng nhập tên loại ưu đãi.", "Thiếu thông tin");
      return;
    }
    if (!code.trim()) {
      toast.warning("Vui lòng nhập mã code định danh.", "Thiếu thông tin");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        code: code.trim().toLowerCase(),
        description: description.trim() || null,
        icon: icon.trim() || "🎁",
        badge_color: badgeColor,
        sort_order: Number(sortOrder) || 0,
        is_active: isActive ? 1 : 0,
      };

      const url = category
        ? `/api/promotions/categories/${category.id}`
        : "/api/promotions/categories";
      const method = category ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể lưu loại ưu đãi.");
      }

      toast.success(
        category ? "Cập nhật loại ưu đãi thành công!" : "Tạo loại ưu đãi mới thành công!",
        "Thành công"
      );
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi lưu loại ưu đãi.", "Lỗi hệ thống");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={category ? "Chỉnh Sửa Loại Ưu Đãi" : "Thêm Loại Ưu Đãi Mới"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <Input
          label="Tên Loại Ưu Đãi *"
          placeholder="VD: Ưu Đãi Theo Mùa / Dịp Lễ, Ưu Đãi Hạng Thành Viên..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {/* Code */}
        <Input
          label="Mã Code Định Danh *"
          placeholder="VD: seasonal, loyalty, flash_sale..."
          value={code}
          onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
          disabled={!!category}
          hint={category ? "Mã định danh không thể thay đổi sau khi tạo." : "Chỉ dùng chữ cái thường, số và dấu gạch dưới."}
          required
        />

        {/* Icon & Color Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Biểu Tượng (Icon)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="w-14 text-center rounded-xl bg-white border border-slate-300 py-2 text-xl font-bold shadow-xs focus:outline-none focus:border-emerald-600"
              />
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {EMOJI_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-base transition-colors border border-slate-200"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Màu Sắc Nhãn
            </label>
            <select
              value={badgeColor}
              onChange={(e) => setBadgeColor(e.target.value as PromotionBadgeColor)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-xs focus:outline-none focus:border-emerald-600"
            >
              {COLOR_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Mô Tả Loại Ưu Đãi
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả mục đích hoặc tiêu chí áp dụng của nhóm ưu đãi này..."
            className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-xs focus:outline-none focus:border-emerald-600 resize-none"
          />
        </div>

        {/* Sort order & Active status */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cat_is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
            />
            <label htmlFor="cat_is_active" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Đang hoạt động (Kích hoạt)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">Thứ tự:</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-16 rounded-lg bg-white border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-center"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Đóng
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting} leftIcon={<span>💾</span>}>
            {category ? "Lưu Thay Đổi" : "Tạo Danh Mục"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
