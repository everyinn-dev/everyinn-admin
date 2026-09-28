"use client";

import React, { useState, useEffect, useMemo } from "react";
import { GanttRoomData } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { notifyDataChanged } from "@/lib/syncEvents";
import {
  TIME_SLOTS_30MIN,
  getVnToday,
  isPastTimeSlot,
  roundUpToNext30Min,
  timeStrToMinutes,
} from "@/lib/timelineUtils";

interface RoomLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  rooms: GanttRoomData[];
  initialRoomId?: string;
}

const REASON_PRESETS = [
  { label: "❄️ Sửa máy lạnh / Thiết bị", value: "Sửa máy lạnh / Thiết bị" },
  { label: "🧹 Không có tạp vụ ca đêm (Đến 09h)", value: "Không có tạp vụ ca đêm" },
  { label: "🎨 Sơn tường / Vệ sinh sâu", value: "Sơn tường / Vệ sinh sâu" },
  { label: "🛠️ Bảo trì phòng", value: "Bảo trì phòng" },
  { label: "📝 Lý do khác", value: "" },
];

function getNextDayStr(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const RoomLockModal: React.FC<RoomLockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  rooms,
  initialRoomId,
}) => {
  const toast = useToast();
  const todayStr = useMemo(() => getVnToday(), []);

  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [reasonPreset, setReasonPreset] = useState<string>("Không có tạp vụ ca đêm");
  const [customReason, setCustomReason] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // Separate Date and 30-minute Time Slots
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [fromTime, setFromTime] = useState<string>("23:00");
  const [toDate, setToDate] = useState<string>(getNextDayStr(todayStr));
  const [toTime, setToTime] = useState<string>("09:00");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize form when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSelectedRoomId(initialRoomId || (rooms.length > 0 ? rooms[0].id : ""));
      setReasonPreset("Không có tạp vụ ca đêm");
      setCustomReason("");
      setNote("");

      const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
      const currentToday = vnNow.toISOString().slice(0, 10);
      const nextSlot = roundUpToNext30Min(vnNow);

      setFromDate(currentToday);
      setFromTime(nextSlot);

      // Default quick end: 09:00 tomorrow morning (very typical for night closures)
      const nextDay = getNextDayStr(currentToday);
      setToDate(nextDay);
      setToTime("09:00");
    }
  }, [isOpen, initialRoomId, rooms]);

  // Compute duration in hours and validate
  const { durationHours, isRangeValid, durationText } = useMemo(() => {
    if (!fromDate || !fromTime || !toDate || !toTime) {
      return { durationHours: 0, isRangeValid: false, durationText: "" };
    }
    const startMs = new Date(`${fromDate}T${fromTime}:00`).getTime();
    const endMs = new Date(`${toDate}T${toTime}:00`).getTime();
    const diffMs = endMs - startMs;

    if (isNaN(diffMs) || diffMs <= 0) {
      return { durationHours: 0, isRangeValid: false, durationText: "Giờ mở phòng phải sau giờ bắt đầu khóa" };
    }

    const hours = diffMs / (3600 * 1000);
    const totalMinutes = Math.round(diffMs / (60 * 1000));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const text = h > 0 ? (m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`) : `${m} phút`;

    return { durationHours: hours, isRangeValid: true, durationText: text };
  }, [fromDate, fromTime, toDate, toTime]);

  if (!isOpen) return null;

  // Quick duration helpers
  const handleSetUntilTomorrow9am = () => {
    const nextDay = getNextDayStr(fromDate || todayStr);
    setToDate(nextDay);
    setToTime("09:00");
  };

  const handleAddHours = (hoursToAdd: number) => {
    const fromMinutes = timeStrToMinutes(fromTime);
    const totalMinutes = fromMinutes + hoursToAdd * 60;

    if (totalMinutes < 24 * 60) {
      // Same day
      setToDate(fromDate);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      setToTime(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
    } else {
      // Next day
      const nextDay = getNextDayStr(fromDate);
      setToDate(nextDay);
      const remainingMinutes = totalMinutes - 24 * 60;
      const h = Math.floor(remainingMinutes / 60);
      const m = remainingMinutes % 60;
      setToTime(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
    }
  };

  const handleSetUntilEndOfDay = () => {
    // End of day is 23:30 or 00:00 next day
    const nextDay = getNextDayStr(fromDate);
    setToDate(nextDay);
    setToTime("00:00");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedRoomId) {
      setErrorMsg("Vui lòng chọn phòng cần khóa.");
      return;
    }

    const finalReason = reasonPreset || customReason.trim();
    if (!finalReason) {
      setErrorMsg("Vui lòng chọn hoặc nhập lý do khóa phòng.");
      return;
    }

    if (!isRangeValid) {
      setErrorMsg("Khoảng thời gian không hợp lệ. Thời gian mở phòng phải sau thời gian bắt đầu khóa.");
      return;
    }

    const fromDateTime = new Date(`${fromDate}T${fromTime}:00`);
    const toDateTime = new Date(`${toDate}T${toTime}:00`);

    if (isNaN(fromDateTime.getTime()) || isNaN(toDateTime.getTime())) {
      setErrorMsg("Thời gian bắt đầu hoặc kết thúc không hợp lệ.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/room-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoomId,
          blockedFrom: fromDateTime.toISOString(),
          blockedTo: toDateTime.toISOString(),
          reason: finalReason,
          note: note.trim() || undefined,
        }),
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        setErrorMsg(data.error || "Không thể tạo khóa phòng. Vui lòng thử lại.");
        toast.warning(data.error || "Không thể tạo khóa phòng.");
        return;
      }

      toast.success(data.message || `Đã khóa phòng thành công.`);
      onSuccess();
      notifyDataChanged("ROOM_BLOCKS_CHANGED");
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Lỗi kết nối máy chủ. Vui lòng kiểm tra lại mạng.");
      toast.error("Lỗi hệ thống khi tạo khóa phòng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 text-base shadow-xs">
              🔒
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Khóa Phòng Tạm Thời / Bảo Trì
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Chặn phòng ca đêm, sửa chữa thiết bị hoặc dọn phòng muộn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-300 flex items-center justify-center transition-colors text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in shadow-xs">
              <span className="text-base leading-none">⚠️</span>
              <span className="leading-relaxed font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* 1. Chọn phòng */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[10px]">
              1. Chọn phòng cần khóa <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {rooms.map((room) => {
                const isSelected = selectedRoomId === room.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`py-2 px-1 rounded-xl text-center border font-bold transition-all cursor-pointer shadow-xs ${
                      isSelected
                        ? "bg-amber-100 border-amber-500 text-amber-950 shadow-xs ring-2 ring-amber-500/20"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-mono font-extrabold">{room.roomNumber}</div>
                    <div className="text-[9px] font-semibold uppercase opacity-80 truncate">
                      {room.roomClass}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Lý do khóa phòng */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[10px]">
              2. Lý do khóa phòng <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {REASON_PRESETS.map((preset) => {
                const isSelected = reasonPreset === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setReasonPreset(preset.value);
                      if (preset.value === "") {
                        setCustomReason("");
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${
                      isSelected
                        ? "bg-amber-100 border-amber-500 text-amber-950 font-bold ring-1 ring-amber-500/20"
                        : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {reasonPreset === "" && (
              <input
                type="text"
                placeholder="Nhập lý do khóa phòng chi tiết..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors shadow-xs"
                autoFocus
              />
            )}
          </div>

          {/* 3. Thời gian khóa (Tách riêng ngày và giờ, bước 30 phút, disable giờ quá khứ) */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <span>⏱️</span>
                <span>3. Khoảng thời gian khóa phòng</span>
                <span className="text-rose-500">*</span>
              </label>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleSetUntilTomorrow9am}
                  className="px-2 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-[10px] text-amber-900 hover:bg-amber-200 transition-colors font-bold cursor-pointer shadow-xs"
                  title="Khóa qua đêm đến 09:00 sáng mai"
                >
                  🌙 Đến 09h mai
                </button>
                <button
                  type="button"
                  onClick={() => handleAddHours(2)}
                  className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[10px] text-slate-700 font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  +2h
                </button>
                <button
                  type="button"
                  onClick={() => handleAddHours(4)}
                  className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[10px] text-slate-700 font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  +4h
                </button>
                <button
                  type="button"
                  onClick={handleSetUntilEndOfDay}
                  className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[10px] text-slate-700 font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Hết hôm nay
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Bắt đầu khóa (Từ) */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <span>🔒</span> Bắt đầu khóa (Từ)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Bước 30 phút</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-500 mb-1 font-medium">Ngày khóa:</span>
                    <input
                      type="date"
                      min={todayStr}
                      value={fromDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setFromDate(val);
                        if (toDate < val) {
                          setToDate(val);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-semibold shadow-xs"
                      required
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-500 mb-1 font-medium">Giờ khóa:</span>
                    <select
                      value={fromTime}
                      onChange={(e) => {
                        const newFromTime = e.target.value;
                        setFromTime(newFromTime);
                        if (toDate === fromDate && timeStrToMinutes(toTime) <= timeStrToMinutes(newFromTime)) {
                          const currentM = timeStrToMinutes(newFromTime);
                          const nextM = currentM + 120;
                          if (nextM < 24 * 60) {
                            const h = Math.floor(nextM / 60);
                            const m = nextM % 60;
                            setToTime(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
                          } else {
                            setToDate(getNextDayStr(fromDate));
                            setToTime("09:00");
                          }
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-mono font-bold shadow-xs"
                      required
                    >
                      {TIME_SLOTS_30MIN.map((slot) => {
                        const isPast = isPastTimeSlot(fromDate, slot);
                        return (
                          <option
                            key={slot}
                            value={slot}
                            disabled={isPast}
                            className={isPast ? "text-slate-400 bg-slate-100 font-normal" : "text-slate-900 bg-white font-semibold"}
                          >
                            {slot} {isPast ? "(Đã qua)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Mở phòng (Đến) */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <span>🔓</span> Mở phòng (Đến)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Bước 30 phút</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-500 mb-1 font-medium">Ngày mở:</span>
                    <input
                      type="date"
                      min={fromDate || todayStr}
                      value={toDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setToDate(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 font-semibold shadow-xs"
                      required
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-500 mb-1 font-medium">Giờ mở:</span>
                    <select
                      value={toTime}
                      onChange={(e) => setToTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 font-mono font-bold shadow-xs"
                      required
                    >
                      {TIME_SLOTS_30MIN.map((slot) => {
                        const isPast = isPastTimeSlot(toDate, slot);
                        const isBeforeOrEqualFrom =
                          toDate === fromDate && timeStrToMinutes(slot) <= timeStrToMinutes(fromTime);
                        const isSlotDisabled = isPast || isBeforeOrEqualFrom;

                        return (
                          <option
                            key={slot}
                            value={slot}
                            disabled={isSlotDisabled}
                            className={
                              isSlotDisabled
                                ? "text-slate-400 bg-slate-100 font-normal"
                                : "text-slate-900 bg-white font-semibold"
                            }
                          >
                            {slot} {isPast ? "(Đã qua)" : isBeforeOrEqualFrom ? "(Trước giờ khóa)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Duration & validation preview */}
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors shadow-xs ${
                isRangeValid
                  ? "bg-amber-50 border-amber-300 text-amber-950"
                  : "bg-rose-50 border-rose-300 text-rose-900"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <span>{isRangeValid ? "⏳" : "⚠️"}</span>
                <span>
                  {isRangeValid
                    ? `Thời lượng khóa: ${durationText}`
                    : "Giờ mở phòng phải sau thời gian bắt đầu khóa"}
                </span>
              </div>
              {isRangeValid && (
                <span className="font-mono font-bold text-[11px] text-amber-900">
                  {fromDate === toDate ? `${fromTime} → ${toTime}` : `${fromDate} ${fromTime} → ${toDate} ${toTime}`}
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-500 italic">
              💡 Lưu ý: Khóa phòng sẽ ghi đè lên giờ dọn phòng (không tạo thêm giờ dọn). Ngay sau khi mở khóa, khách có thể đặt phòng bình thường.
            </p>
          </div>

          {/* 4. Ghi chú thêm */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
              4. Ghi chú chi tiết (Tùy chọn)
            </label>
            <textarea
              rows={2}
              placeholder="Ví dụ: Thợ điện hẹn 14:00 qua thay tụ quạt, chìa khóa gửi lễ tân ca sáng..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors resize-none shadow-xs"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors font-semibold cursor-pointer shadow-xs"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>🔒</span>
                  <span>Xác nhận Khóa phòng</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
