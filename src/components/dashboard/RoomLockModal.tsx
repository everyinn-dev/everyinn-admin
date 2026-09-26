"use client";

import React, { useState, useEffect, useMemo } from "react";
import { GanttRoomData } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d131f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#121927]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-base shadow-sm">
              🔒
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Khóa Phòng Tạm Thời / Bảo Trì
              </h2>
              <p className="text-[11px] text-slate-400">
                Chặn phòng ca đêm, sửa chữa thiết bị hoặc dọn phòng muộn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
              <span className="text-base leading-none">⚠️</span>
              <span className="leading-relaxed font-medium">{errorMsg}</span>
            </div>
          )}

          {/* 1. Chọn phòng */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider text-[10px]">
              1. Chọn phòng cần khóa <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {rooms.map((room) => {
                const isSelected = selectedRoomId === room.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`py-2 px-1 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-md ring-1 ring-amber-500/40"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="text-sm font-mono">{room.roomNumber}</div>
                    <div className="text-[9px] font-normal uppercase opacity-75 truncate">
                      {room.roomClass}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Lý do khóa phòng */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider text-[10px]">
              2. Lý do khóa phòng <span className="text-rose-400">*</span>
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
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-200 font-semibold"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
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
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                autoFocus
              />
            )}
          </div>

          {/* 3. Thời gian khóa (Tách riêng ngày và giờ, bước 30 phút, disable giờ quá khứ) */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <label className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <span>⏱️</span>
                <span>3. Khoảng thời gian khóa phòng</span>
                <span className="text-rose-400">*</span>
              </label>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleSetUntilTomorrow9am}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 hover:bg-amber-500/25 transition-colors font-medium cursor-pointer"
                  title="Khóa qua đêm đến 09:00 sáng mai"
                >
                  🌙 Đến 09h mai
                </button>
                <button
                  type="button"
                  onClick={() => handleAddHours(2)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                >
                  +2h
                </button>
                <button
                  type="button"
                  onClick={() => handleAddHours(4)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                >
                  +4h
                </button>
                <button
                  type="button"
                  onClick={handleSetUntilEndOfDay}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                >
                  Hết hôm nay
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Bắt đầu khóa (Từ) */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <span>🔒</span> Bắt đầu khóa (Từ)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Bước 30 phút</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Ngày khóa:</span>
                    <input
                      type="date"
                      min={todayStr}
                      value={fromDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setFromDate(val);
                        // If toDate is before new fromDate, align toDate
                        if (toDate < val) {
                          setToDate(val);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121927] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Giờ khóa:</span>
                    <select
                      value={fromTime}
                      onChange={(e) => {
                        const newFromTime = e.target.value;
                        setFromTime(newFromTime);
                        // If same day and toTime <= newFromTime, advance toTime
                        if (toDate === fromDate && timeStrToMinutes(toTime) <= timeStrToMinutes(newFromTime)) {
                          const currentM = timeStrToMinutes(newFromTime);
                          const nextM = currentM + 120; // +2 hours
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
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121927] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-mono font-medium"
                      required
                    >
                      {TIME_SLOTS_30MIN.map((slot) => {
                        const isPast = isPastTimeSlot(fromDate, slot);
                        return (
                          <option
                            key={slot}
                            value={slot}
                            disabled={isPast}
                            className={isPast ? "text-slate-600 bg-slate-950 font-normal" : "text-slate-100 bg-[#121927] font-semibold"}
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
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <span>🔓</span> Mở phòng (Đến)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Bước 30 phút</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Ngày mở:</span>
                    <input
                      type="date"
                      min={fromDate || todayStr}
                      value={toDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setToDate(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121927] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Giờ mở:</span>
                    <select
                      value={toTime}
                      onChange={(e) => setToTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#121927] border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-mono font-medium"
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
                                ? "text-slate-600 bg-slate-950 font-normal"
                                : "text-slate-100 bg-[#121927] font-semibold"
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
              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                isRangeValid
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                <span>{isRangeValid ? "⏳" : "⚠️"}</span>
                <span>
                  {isRangeValid
                    ? `Thời lượng khóa: ${durationText}`
                    : "Giờ mở phòng phải sau thời gian bắt đầu khóa"}
                </span>
              </div>
              {isRangeValid && (
                <span className="font-mono font-semibold text-[11px] text-amber-300">
                  {fromDate === toDate ? `${fromTime} → ${toTime}` : `${fromDate} ${fromTime} → ${toDate} ${toTime}`}
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-400 italic">
              💡 Lưu ý: Khóa phòng sẽ ghi đè lên giờ dọn phòng (không tạo thêm giờ dọn). Ngay sau khi mở khóa, khách có thể đặt phòng bình thường.
            </p>
          </div>

          {/* 4. Ghi chú thêm */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1 uppercase tracking-wider text-[10px]">
              4. Ghi chú chi tiết (Tùy chọn)
            </label>
            <textarea
              rows={2}
              placeholder="Ví dụ: Thợ điện hẹn 14:00 qua thay tụ quạt, chìa khóa gửi lễ tân ca sáng..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
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
