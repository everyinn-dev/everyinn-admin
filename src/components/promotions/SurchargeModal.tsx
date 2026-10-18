"use client";

import React, { useState } from "react";
import { BookingType, RoomClass, SurchargeRule } from "@/types";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { clearCache, CACHE_KEY } from "@/lib/localCache";

interface SurchargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule: SurchargeRule | null;
  onSaved: () => void;
}

const ROOM_CLASS_OPTIONS: { id: RoomClass; label: string }[] = [
  { id: "haven", label: "Haven (Tối đa 2 khách)" },
  { id: "signature", label: "Signature (Tối đa 4 khách)" },
];

const BOOKING_TYPE_OPTIONS: { id: BookingType; label: string }[] = [
  { id: "hourly", label: "Theo Giờ" },
  { id: "overnight", label: "Qua Đêm" },
  { id: "dayuse", label: "Theo Ngày" },
  { id: "custom", label: "Tuỳ Chỉnh" },
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

export const SurchargeModal: React.FC<SurchargeModalProps> = ({
  isOpen,
  onClose,
  rule,
  onSaved,
}) => {
  const toast = useToast();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [surchargeType, setSurchargeType] = useState<"holiday" | "extra_guest" | "custom_fee">("holiday");
  const [calcMode, setCalcMode] = useState<"percentage" | "fixed_amount">("percentage");
  const [amount, setAmount] = useState<number | string>(20);
  const [unitScope, setUnitScope] = useState<"per_night" | "per_guest_night" | "per_booking">("per_night");
  const [guestThreshold, setGuestThreshold] = useState<number | string>(2);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [roomClasses, setRoomClasses] = useState<RoomClass[]>(["haven", "signature"]);
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>(["hourly", "overnight", "dayuse", "custom"]);
  const [priority, setPriority] = useState<number | string>(10);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [prevKey, setPrevKey] = useState<string | null>(null);
  const currentKey = isOpen ? (rule ? rule.id : "new") : null;

  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (rule) {
      setName(rule.name);
      setCode(rule.code);
      setSurchargeType(rule.surcharge_type);
      setCalcMode(rule.calc_mode);
      setAmount(rule.amount);
      setUnitScope(rule.unit_scope);
      setGuestThreshold(rule.guest_threshold ?? 2);
      setStartDate(rule.start_date || "");
      setEndDate(rule.end_date || "");
      setDaysOfWeek(rule.applicable_days_of_week || [0, 1, 2, 3, 4, 5, 6]);
      setRoomClasses(rule.applicable_room_classes || ["haven", "signature"]);
      setBookingTypes(rule.applicable_booking_types || ["hourly", "overnight", "dayuse", "custom"]);
      setPriority(rule.priority ?? 10);
      setIsActive(rule.is_active === 1);
    } else {
      setName("");
      setCode("");
      setSurchargeType("holiday");
      setCalcMode("percentage");
      setAmount(20);
      setUnitScope("per_night");
      setGuestThreshold(2);
      setStartDate("");
      setEndDate("");
      setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
      setRoomClasses(["haven", "signature"]);
      setBookingTypes(["hourly", "overnight", "dayuse", "custom"]);
      setPriority(10);
      setIsActive(true);
    }
  }

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? (prev.length > 1 ? prev.filter((d) => d !== day) : prev) : [...prev, day]
    );
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.warning("Vui lòng nhập đầy đủ Tên và Mã quy tắc phụ thu.", "Thiếu thông tin");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        surcharge_type: surchargeType,
        calc_mode: calcMode,
        amount: Number(amount),
        unit_scope: unitScope,
        guest_threshold: Number(guestThreshold) || 2,
        start_date: startDate || null,
        end_date: endDate || null,
        applicable_days_of_week: daysOfWeek,
        applicable_room_classes: roomClasses,
        applicable_booking_types: bookingTypes,
        priority: Number(priority) || 0,
        is_active: isActive ? 1 : 0,
        expectedVersion: rule?.version ?? 1,
      };

      const url = rule ? `/api/surcharges/${rule.id}` : "/api/surcharges";
      const method = rule ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể lưu quy tắc phụ thu.");
      }

      // Clear cached configs so NewBookingPage picks up fresh surchargeRules
      clearCache(CACHE_KEY.CONFIGS);

      toast.success(
        rule ? "Đã cập nhật quy tắc phụ thu!" : "Đã tạo quy tắc phụ thu mới!",
        "Thành công"
      );
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi lưu quy tắc phụ thu.", "Lỗi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rule ? "Chỉnh Sửa Quy Tắc Phụ Thu" : "Tạo Quy Tắc Phụ Thu Lễ / Khách Thêm"}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              label="Tên Quy Tắc Phụ Thu *"
              placeholder="VD: Phụ thu Lễ Quốc Khánh 2/9 (+25%)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Input
              label="Mã Quy Tắc (Code) *"
              placeholder="VD: HOLIDAY_2_9"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Loại Phụ Thu *</label>
            <select
              value={surchargeType}
              onChange={(e) => {
                const v = e.target.value as "holiday" | "extra_guest" | "custom_fee";
                setSurchargeType(v);
                if (v === "extra_guest") {
                  setCalcMode("fixed_amount");
                  setUnitScope("per_guest_night");
                  setRoomClasses(["signature"]);
                  setAmount(150000);
                } else if (v === "holiday") {
                  setCalcMode("percentage");
                  setUnitScope("per_night");
                }
              }}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
            >
              <option value="holiday">🎌 Phụ thu Ngày Lễ / Tết</option>
              <option value="extra_guest">👥 Phụ thu Khách thêm (&gt;2 người)</option>
              <option value="custom_fee">⚡ Phụ phí khác</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Cách tính *</label>
            <select
              value={calcMode}
              onChange={(e) => setCalcMode(e.target.value as "percentage" | "fixed_amount")}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
            >
              <option value="percentage">Theo % Giá cơ bản</option>
              <option value="fixed_amount">Số tiền cố định (VNĐ)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {calcMode === "percentage" ? "Mức phụ thu (%) *" : "Số tiền phụ thu (VNĐ) *"}
            </label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-amber-900"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Đơn vị nhân (Scope)</label>
            <select
              value={unitScope}
              onChange={(e) => setUnitScope(e.target.value as any)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
            >
              <option value="per_night">Mỗi đêm / ca lưu trú (Per Night)</option>
              <option value="per_guest_night">Mỗi khách vượt × Mỗi đêm/ca</option>
              <option value="per_booking">1 lần cho cả booking</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Số khách tiêu chuẩn</label>
            <input
              type="number"
              min="1"
              max="10"
              value={guestThreshold}
              onChange={(e) => setGuestThreshold(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Độ ưu tiên (Priority)</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-slate-900"
            />
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Từ ngày lưu trú (Để trống = Quanh năm)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Đến ngày lưu trú (Inclusive)
            </label>
            <input
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800"
            />
          </div>
        </div>

        {/* Days of Week */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">Ngày trong tuần áp dụng:</label>
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
                      ? "bg-amber-600 text-white border-amber-700"
                      : "bg-white text-slate-600 border-slate-300"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Room Classes & Booking Types */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Hạng phòng áp dụng:</label>
            <div className="flex gap-2">
              {ROOM_CLASS_OPTIONS.map((rc) => {
                const selected = roomClasses.includes(rc.id);
                return (
                  <button
                    key={rc.id}
                    type="button"
                    onClick={() => toggleRoomClass(rc.id)}
                    className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-bold ${
                      selected
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    {rc.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Hình thức đặt áp dụng:</label>
            <div className="grid grid-cols-2 gap-1.5">
              {BOOKING_TYPE_OPTIONS.map((bt) => {
                const selected = bookingTypes.includes(bt.id);
                return (
                  <button
                    key={bt.id}
                    type="button"
                    onClick={() => toggleBookingType(bt.id)}
                    className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold ${
                      selected
                        ? "bg-emerald-700 text-white border-emerald-800"
                        : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    {bt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600"
            />
            <span>Đang kích hoạt áp dụng tự động</span>
          </label>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Đóng
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {rule ? "Lưu Thay Đổi" : "Tạo Quy Tắc"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
