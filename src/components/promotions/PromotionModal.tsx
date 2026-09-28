"use client";

import React, { useState, useEffect } from "react";
import {
  Promotion,
  PromotionCategory,
  DiscountType,
} from "@/types/promotions";
import { BookingType, LoyaltyTier, RoomClass } from "@/types";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

interface PromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotion: Promotion | null;
  categories: PromotionCategory[];
  onSaved: () => void;
}

const ROOM_CLASS_OPTIONS: { id: RoomClass; label: string }[] = [
  { id: "haven", label: "Haven (22m²)" },
  { id: "signature", label: "Signature (28m²)" },
];

const BOOKING_TYPE_OPTIONS: { id: BookingType; label: string }[] = [
  { id: "hourly", label: "Theo Giờ" },
  { id: "overnight", label: "Qua Đêm" },
  { id: "dayuse", label: "Theo Ngày" },
  { id: "custom", label: "Tuỳ Chỉnh" },
];

const LOYALTY_TIER_OPTIONS: { id: LoyaltyTier; label: string; icon: string }[] = [
  { id: "new", label: "Khách Mới", icon: "🌱" },
  { id: "bronze", label: "Bronze (≥500k)", icon: "🥉" },
  { id: "silver", label: "Silver (≥3tr/5đơn)", icon: "🥈" },
  { id: "gold", label: "Gold (≥8tr/10đơn)", icon: "🥇" },
];

const DAYS_OF_WEEK = [
  { val: 1, label: "T2" },
  { val: 2, label: "T3" },
  { val: 3, label: "T4" },
  { val: 4, label: "T5" },
  { val: 5, label: "T6" },
  { val: 6, label: "T7" },
  { val: 0, label: "CN" },
];

export const PromotionModal: React.FC<PromotionModalProps> = ({
  isOpen,
  onClose,
  promotion,
  categories,
  onSaved,
}) => {
  const toast = useToast();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState<number | string>(10);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number | string>("");
  const [minOrderAmount, setMinOrderAmount] = useState<number | string>(0);

  // Conditions
  const [roomClasses, setRoomClasses] = useState<RoomClass[]>(["haven", "signature"]);
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>([
    "hourly",
    "overnight",
    "dayuse",
    "custom",
  ]);
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>([
    "new",
    "bronze",
    "silver",
    "gold",
  ]);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Seasonal / Date Validity
  const [hasDateLimit, setHasDateLimit] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Usage Limit
  const [hasUsageLimit, setHasUsageLimit] = useState(false);
  const [usageLimit, setUsageLimit] = useState<number | string>("");

  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (promotion) {
      setName(promotion.name || "");
      setCode(promotion.code || "");
      setCategoryId(promotion.category_id || (categories[0]?.id || ""));
      setDescription(promotion.description || "");
      setDiscountType(promotion.discount_type || "percentage");
      setDiscountValue(promotion.discount_value || 0);
      setMaxDiscountAmount(promotion.max_discount_amount ?? "");
      setMinOrderAmount(promotion.min_order_amount ?? 0);
      setRoomClasses(promotion.applicable_room_classes || ["haven", "signature"]);
      setBookingTypes(promotion.applicable_booking_types || ["hourly", "overnight", "dayuse", "custom"]);
      setLoyaltyTiers(promotion.applicable_loyalty_tiers || ["new", "bronze", "silver", "gold"]);
      setDaysOfWeek(promotion.applicable_days_of_week || [0, 1, 2, 3, 4, 5, 6]);
      setHasDateLimit(!!(promotion.start_date || promotion.end_date));
      setStartDate(promotion.start_date || "");
      setEndDate(promotion.end_date || "");
      setHasUsageLimit(promotion.usage_limit !== null && promotion.usage_limit !== undefined);
      setUsageLimit(promotion.usage_limit ?? "");
      setIsActive(promotion.is_active === 1);
    } else {
      setName("");
      setCode("");
      setCategoryId(categories[0]?.id || "");
      setDescription("");
      setDiscountType("percentage");
      setDiscountValue(10);
      setMaxDiscountAmount(100000);
      setMinOrderAmount(0);
      setRoomClasses(["haven", "signature"]);
      setBookingTypes(["hourly", "overnight", "dayuse", "custom"]);
      setLoyaltyTiers(["new", "bronze", "silver", "gold"]);
      setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
      setHasDateLimit(false);
      setStartDate("");
      setEndDate("");
      setHasUsageLimit(false);
      setUsageLimit("");
      setIsActive(true);
    }
  }, [promotion, categories, isOpen]);

  const toggleRoomClass = (rc: RoomClass) => {
    setRoomClasses((prev) =>
      prev.includes(rc) ? (prev.length > 1 ? prev.filter((r) => r !== rc) : prev) : [...prev, rc]
    );
  };

  const toggleBookingType = (bt: BookingType) => {
    setBookingTypes((prev) =>
      prev.includes(bt) ? (prev.length > 1 ? prev.filter((b) => b !== bt) : prev) : [...prev, bt]
    );
  };

  const toggleLoyaltyTier = (tier: LoyaltyTier) => {
    setLoyaltyTiers((prev) =>
      prev.includes(tier) ? (prev.length > 1 ? prev.filter((t) => t !== tier) : prev) : [...prev, tier]
    );
  };

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? (prev.length > 1 ? prev.filter((d) => d !== day) : prev) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning("Vui lòng nhập tên chương trình ưu đãi.", "Thiếu tên");
      return;
    }
    if (!categoryId) {
      toast.warning("Vui lòng chọn danh mục loại ưu đãi.", "Thiếu danh mục");
      return;
    }
    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) {
      toast.warning("Giá trị giảm giá phải lớn hơn 0.", "Giá trị không hợp lệ");
      return;
    }
    if (discountType === "percentage" && val > 100) {
      toast.warning("Tỷ lệ giảm theo % không được vượt quá 100%.", "Lỗi phần trăm");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : null,
        category_id: categoryId,
        description: description.trim() || null,
        discount_type: discountType,
        discount_value: val,
        max_discount_amount:
          discountType === "percentage" && maxDiscountAmount !== ""
            ? Number(maxDiscountAmount)
            : null,
        min_order_amount: Number(minOrderAmount) || 0,
        applicable_room_classes: roomClasses,
        applicable_booking_types: bookingTypes,
        applicable_loyalty_tiers: loyaltyTiers,
        applicable_days_of_week: daysOfWeek,
        start_date: hasDateLimit && startDate ? startDate : null,
        end_date: hasDateLimit && endDate ? endDate : null,
        usage_limit: hasUsageLimit && usageLimit !== "" ? Number(usageLimit) : null,
        is_active: isActive ? 1 : 0,
      };

      const url = promotion ? `/api/promotions/${promotion.id}` : "/api/promotions";
      const method = promotion ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể lưu chương trình ưu đãi.");
      }

      toast.success(
        promotion ? "Cập nhật ưu đãi thành công!" : "Tạo ưu đãi mới thành công!",
        "Thành công"
      );
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi lưu chương trình ưu đãi.", "Lỗi hệ thống");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={promotion ? "Chỉnh Sửa Chương Trình Ưu Đãi" : "Tạo Chương Trình Ưu Đãi Mới"}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-slate-800">
        {/* Section 1: Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              label="Tên Chương Trình Ưu Đãi *"
              placeholder="VD: Mùa Thu Vàng - Giảm 10%, Đặc Quyền Gold 15%..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <Input
              label="Mã Voucher (Code)"
              placeholder="VD: THUVANG10"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
              hint="Viết hoa, không dấu (Tùy chọn)"
            />
          </div>
        </div>

        {/* Category & Description */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Loại Ưu Đãi *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-900 shadow-xs focus:outline-none focus:border-emerald-600"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Mô Tả & Thể Lệ Chương Trình
            </label>
            <input
              type="text"
              placeholder="VD: Áp dụng ngày trong tuần từ T2-T5 cho mọi hạng phòng..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Section 2: Discount Mechanism */}
        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>💰</span>
              <span>Cơ Chế Chiết Khấu Giảm Giá</span>
            </span>

            {/* Toggle Discount Type */}
            <div className="flex items-center bg-white rounded-lg p-0.5 border border-emerald-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setDiscountType("percentage")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  discountType === "percentage"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Giảm theo %
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("fixed_amount")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  discountType === "fixed_amount"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Giảm tiền cố định (VNĐ)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {discountType === "percentage" ? "Mức giảm (%) *" : "Số tiền giảm (VNĐ) *"}
              </label>
              <input
                type="number"
                min="1"
                max={discountType === "percentage" ? 100 : undefined}
                step={discountType === "percentage" ? 1 : "any"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "VD: 10, 15, 20" : "VD: 50000"}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-emerald-700 shadow-xs focus:outline-none focus:border-emerald-600"
                required
              />
            </div>

            {discountType === "percentage" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giảm tối đa (VNĐ)
                </label>
                <input
                  type="number"
                  step="any"
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  placeholder="Để trống nếu không giới hạn"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-800 shadow-xs focus:outline-none focus:border-emerald-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Đơn tối thiểu (VNĐ)
              </label>
              <input
                type="number"
                step="any"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="0 = Không yêu cầu"
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-800 shadow-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Seasonal & Time Validity */}
        <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>🍂</span>
              <span>Thời Hạn Hiệu Lực (Ưu Đãi Theo Mùa / Thời Gian)</span>
            </span>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={hasDateLimit}
                onChange={(e) => setHasDateLimit(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Giới hạn thời gian (Seasonal)</span>
            </label>
          </div>

          {hasDateLimit ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Từ ngày (Bắt đầu)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 shadow-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Đến ngày (Kết thúc)</label>
                <input
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 shadow-xs"
                />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-amber-800 font-medium">
              ✨ Ưu đãi này đang áp dụng quanh năm / vô thời hạn. (Bật checkbox bên trên nếu đây là chiến dịch seasonal theo ngày).
            </p>
          )}

          {/* Days of week */}
          <div className="pt-2 border-t border-amber-200/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Ngày trong tuần áp dụng:</label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cả tuần
                </button>
                <button
                  type="button"
                  onClick={() => setDaysOfWeek([1, 2, 3, 4])}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  T2 - T5
                </button>
                <button
                  type="button"
                  onClick={() => setDaysOfWeek([5, 6, 0])}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  T6 - CN
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {DAYS_OF_WEEK.map((d) => {
                const selected = daysOfWeek.includes(d.val);
                return (
                  <button
                    key={d.val}
                    type="button"
                    onClick={() => toggleDayOfWeek(d.val)}
                    className={`w-9 h-8 rounded-lg text-xs font-bold transition-all border ${
                      selected
                        ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 4: Target Audience (Loyalty Tiers) */}
        <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>👑</span>
              <span>Đặc Quyền Hạng Thành Viên Mini CDP</span>
            </span>

            <button
              type="button"
              onClick={() =>
                setLoyaltyTiers(
                  loyaltyTiers.length === 4 ? ["gold"] : ["new", "bronze", "silver", "gold"]
                )
              }
              className="text-[11px] font-bold text-purple-700 hover:underline"
            >
              {loyaltyTiers.length === 4 ? "Chỉ chọn Gold" : "Chọn tất cả"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LOYALTY_TIER_OPTIONS.map((tier) => {
              const selected = loyaltyTiers.includes(tier.id);
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => toggleLoyaltyTier(tier.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selected
                      ? "bg-purple-600 text-white border-purple-700 shadow-xs font-bold"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-purple-50/40"
                  }`}
                >
                  <div className="text-sm">{tier.icon}</div>
                  <div className="text-xs font-bold mt-0.5">{tier.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 5: Room & Booking Type Conditions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Room Class */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
              Hạng phòng áp dụng:
            </label>
            <div className="flex items-center gap-2">
              {ROOM_CLASS_OPTIONS.map((rc) => {
                const selected = roomClasses.includes(rc.id);
                return (
                  <button
                    key={rc.id}
                    type="button"
                    onClick={() => toggleRoomClass(rc.id)}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      selected
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {rc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Booking Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
              Hình thức đặt áp dụng:
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {BOOKING_TYPE_OPTIONS.map((bt) => {
                const selected = bookingTypes.includes(bt.id);
                return (
                  <button
                    key={bt.id}
                    type="button"
                    onClick={() => toggleBookingType(bt.id)}
                    className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold transition-all ${
                      selected
                        ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {bt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 6: Limits & Status */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
              <input
                type="checkbox"
                checked={hasUsageLimit}
                onChange={(e) => setHasUsageLimit(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Giới hạn tổng lượt dùng:</span>
            </label>
            {hasUsageLimit && (
              <input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="VD: 100"
                className="w-24 rounded-lg bg-white border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-center"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="promo_is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
            />
            <label htmlFor="promo_is_active" className="text-xs font-bold text-slate-800 cursor-pointer">
              Đang kích hoạt (Cho phép áp dụng)
            </label>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Đóng
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting} leftIcon={<span>💾</span>}>
            {promotion ? "Lưu Thay Đổi" : "Tạo Ưu Đãi"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
