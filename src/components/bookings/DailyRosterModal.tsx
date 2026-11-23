"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookingOpsStateEntry,
} from "@/lib/rosterDoorCodes";
import { agentApi, AgentApiError } from "@/lib/agentApi";
import { apiFetch } from "@/lib/apiClient";
import { addDaysYmd } from "@/lib/doorCodeUtils";
import { formatVn, roomBlockTypeOf } from "@/lib/roomBlocks";
import { subscribeToSyncEvents } from "@/lib/syncEvents";
import { formatTimeShort, getVnToday } from "@/lib/timelineUtils";
import {
  CheckinGuideStatus,
  DailyRosterHousekeepingTask,
  DailyRosterItem,
  DailyRosterResponse,
  GanttBookingItem,
  HousekeepingStatus,
} from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

interface DailyRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  refreshSignal?: number;
  onSelectBooking?: (booking: GanttBookingItem) => void;
  onOpenDoorCodes?: () => void;
}

type ViewTab = "overview" | "checkin" | "housekeeping";
type CheckinTriage = "all" | "unsent" | "missing_code" | "collect" | "pending";
type HkTriage = "all" | "urgent" | "pending" | "cleaning" | "done";

const BOOKING_TYPE_META: Record<string, { label: string; cls: string }> = {
  hourly: { label: "Theo giờ", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  overnight: { label: "Qua đêm", cls: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  dayuse: { label: "Theo ngày", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  custom: { label: "Tùy chỉnh", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

const CHANNEL_LABEL: Record<string, string> = {
  web: "Web",
  admin: "Admin",
  chat: "Chat AI",
};

function formatDateHeading(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const ms = Date.parse(`${ymd}T12:00:00+07:00`);
  const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const wd = weekdays[new Date(ms + 7 * 3600_000).getUTCDay()] ?? "";
  return `${wd}, ${parts[2]}/${parts[1]}/${parts[0]}`;
}

async function copyTextSafe(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to execCommand below when Clipboard API permission is restricted
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export const DailyRosterModal: React.FC<DailyRosterModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  refreshSignal = 0,
  onSelectBooking,
  onOpenDoorCodes,
}) => {
  const toast = useToast();
  const vnToday = useMemo(() => getVnToday(), []);
  const vnTomorrow = useMemo(() => addDaysYmd(vnToday, 1), [vnToday]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate || vnToday);
  const [prevSyncKey, setPrevSyncKey] = useState<string>(`${isOpen ? "1" : "0"}:${initialDate ?? ""}`);
  const [data, setData] = useState<DailyRosterResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("overview");
  const [checkinFilter, setCheckinFilter] = useState<CheckinTriage>("all");
  const [hkFilter, setHkFilter] = useState<HkTriage>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const syncKey = `${isOpen ? "1" : "0"}:${initialDate ?? ""}`;
  if (prevSyncKey !== syncKey) {
    setPrevSyncKey(syncKey);
    if (isOpen && initialDate) {
      setSelectedDate(initialDate);
    }
  }

  const fetchRoster = useCallback(async (dateStr: string, signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch(`/api/bookings/daily-roster?date=${encodeURIComponent(dateStr)}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
        signal,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || `Lỗi tải dữ liệu (${res.status})`);
      }
      const json = (await res.json()) as DailyRosterResponse;
      if (!signal?.aborted) {
        setData(json);
      }
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) return;
      const msg = err instanceof Error ? err.message : "Không tải được lịch điều phối ngày.";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void fetchRoster(selectedDate, controller.signal);
      }
    });
    return () => controller.abort();
  }, [isOpen, selectedDate, refreshSignal, fetchRoster]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unsub = subscribeToSyncEvents(() => {
      fetchRoster(selectedDate);
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      unsub();
    };
  }, [isOpen, onClose, selectedDate, fetchRoster]);

  const checkins = useMemo(() => data?.checkins ?? [], [data]);
  const housekeepingTasks = useMemo(() => data?.housekeepingTasks ?? [], [data]);
  const blocks = useMemo(() => data?.blocks ?? [], [data]);

  const queryNorm = searchQuery.trim().toLowerCase();

  const matchesSearch = useCallback(
    (fields: Array<string | null | undefined>) => {
      if (!queryNorm) return true;
      return fields.some((f) => typeof f === "string" && f.toLowerCase().includes(queryNorm));
    },
    [queryNorm],
  );

  const filteredCheckins = useMemo(() => {
    return checkins.filter((c) => {
      if (!matchesSearch([c.guestName, c.roomNumber, c.roomName, c.phone, c.id, c.note, c.closingNote])) return false;
      if (checkinFilter === "unsent") return c.status === "confirmed" && (c.checkinGuideStatus ?? "pending") === "pending";
      if (checkinFilter === "missing_code") return c.status === "confirmed" && !c.doorCode;
      if (checkinFilter === "collect") return (c.remainingAmount ?? 0) > 0;
      if (checkinFilter === "pending") return c.status === "pending";
      return true;
    });
  }, [checkins, checkinFilter, matchesSearch]);

  const filteredHkTasks = useMemo(() => {
    return housekeepingTasks.filter((t) => {
      if (!matchesSearch([t.roomNumber, t.roomName, t.guestName, t.note, t.closingNote, t.nextCheckin?.guestName, t.nextCheckin?.note])) {
        return false;
      }
      const st = t.hkStatus ?? "pending";
      if (hkFilter === "urgent") return t.urgent && st !== "done";
      if (hkFilter === "pending") return st === "pending";
      if (hkFilter === "cleaning") return st === "cleaning";
      if (hkFilter === "done") return st === "done";
      return true;
    });
  }, [housekeepingTasks, hkFilter, matchesSearch]);

  const applyCheckinGuideState = useCallback((bookingId: string, st: BookingOpsStateEntry) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextCheckins = prev.checkins.map((c) =>
        c.id === bookingId
          ? {
              ...c,
              checkinGuideStatus: st.checkinGuideStatus as CheckinGuideStatus,
              checkinGuideSentAt: st.checkinGuideSentAt,
              checkinGuideSentByName: st.checkinGuideSentByName,
            }
          : c,
      );
      return {
        ...prev,
        checkins: nextCheckins,
        summary: {
          ...prev.summary,
          guideUnsentCount: nextCheckins.filter((c) => c.status === "confirmed" && (c.checkinGuideStatus ?? "pending") === "pending").length,
        },
      };
    });
  }, []);

  const applyHousekeepingState = useCallback((refId: string, st: BookingOpsStateEntry) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextTasks = prev.housekeepingTasks.map((t) =>
        t.refId === refId
          ? {
              ...t,
              hkStatus: st.hkStatus as HousekeepingStatus,
              hkUpdatedAt: st.hkUpdatedAt,
              hkUpdatedByName: st.hkUpdatedByName,
            }
          : t,
      );
      return {
        ...prev,
        housekeepingTasks: nextTasks,
        summary: {
          ...prev.summary,
          hkDoneCount: nextTasks.filter((t) => t.hkStatus === "done").length,
          hkUrgentCount: nextTasks.filter((t) => t.urgent && t.hkStatus !== "done").length,
        },
      };
    });
  }, []);

  const handleCopyStandardGuide = async (item: DailyRosterItem) => {
    setBusyActionId(`copy:${item.id}`);
    try {
      const res = await agentApi<{
        bookingId: string;
        ready: boolean;
        message: string | null;
        missing: Array<"gate" | "lockbox">;
      }>(`ops/bookings/${encodeURIComponent(item.id)}/guide-message`, {
        method: "POST",
        body: {
          roomId: item.roomId,
          roomName: item.roomName,
          roomNumber: item.roomNumber,
          guestName: item.guestName,
          checkinAt: item.checkinAt,
          checkoutAt: item.checkoutAt,
        },
      });
      const payload = res.data;
      if (!payload?.ready || !payload.message) {
        const missingLabel = (payload?.missing ?? ["gate", "lockbox"])
          .map((m) => (m === "gate" ? "mã cổng" : "mã hộp khóa"))
          .join(" & ");
        toast.warning(`Phòng ${item.roomNumber || item.roomName} chưa đủ ${missingLabel}. Vui lòng cài mã trước khi gửi khách.`, "Thiếu mã cửa");
        return;
      }
      const copied = await copyTextSafe(payload.message);
      if (copied) {
        toast.success(`Đã sao chép mẫu hướng dẫn nhận phòng P.${item.roomNumber || item.roomName} (${item.guestName}).`, "Đã chép hướng dẫn chuẩn");
      } else {
        toast.error("Trình duyệt từ chối quyền ghi bộ nhớ tạm. Vui lòng thử lại hoặc dùng nút Mở Mã cửa.");
      }
    } catch (err) {
      toast.error(err instanceof AgentApiError ? err.message : "Không lấy được mẫu hướng dẫn từ AI Lễ Tân.");
    } finally {
      setBusyActionId(null);
    }
  };

  const handleToggleGuideSent = async (item: DailyRosterItem) => {
    const currentlySent = (item.checkinGuideStatus ?? "pending") !== "pending";
    const nextSent = !currentlySent;
    setBusyActionId(`sent:${item.id}`);
    try {
      const res = await agentApi<{ state: BookingOpsStateEntry }>(`ops/bookings/${encodeURIComponent(item.id)}/guide-sent`, {
        method: "POST",
        body: { sent: nextSent },
      });
      if (res.data?.state) {
        applyCheckinGuideState(item.id, res.data.state);
      }
      toast.success(nextSent ? `Đã đánh dấu gửi hướng dẫn cho ${item.guestName}.` : `Đã chuyển ${item.guestName} về trạng thái chưa gửi.`);
    } catch (err) {
      toast.error(err instanceof AgentApiError ? err.message : "Không cập nhật được trạng thái gửi hướng dẫn.");
    } finally {
      setBusyActionId(null);
    }
  };

  const handleSetHkStatus = async (task: DailyRosterHousekeepingTask, status: HousekeepingStatus) => {
    setBusyActionId(`hk:${task.refId}`);
    try {
      const res = await agentApi<{ state: BookingOpsStateEntry }>(`ops/bookings/${encodeURIComponent(task.refId)}/housekeeping`, {
        method: "POST",
        body: { status },
      });
      if (res.data?.state) {
        applyHousekeepingState(task.refId, res.data.state);
      }
      const label = status === "done" ? "Đã dọn xong" : status === "cleaning" ? "Đang dọn" : "Chưa dọn";
      toast.success(`${task.roomName} (${formatTimeShort(task.turnoverStartAt)}): ${label}.`);
    } catch (err) {
      toast.error(err instanceof AgentApiError ? err.message : "Không cập nhật được trạng thái dọn phòng.");
    } finally {
      setBusyActionId(null);
    }
  };

  /** Safe operational briefing without plaintext door codes or housekeeping PII phone numbers. */
  const handleCopySafeDailyReport = async () => {
    if (!data) return;
    const lines: string[] = [
      `BÁO CÁO ĐIỀU PHỐI NGÀY ${formatDateHeading(selectedDate).toUpperCase()}`,
      `Check-in: ${data.summary.totalCheckins} (${data.summary.hourlyCount} giờ · ${data.summary.overnightCount} đêm · ${data.summary.dayuseCount} ngày · ${data.summary.customCount} tùy chỉnh)`,
      `Dọn phòng: ${data.housekeepingTasks.length} lượt · Khóa phòng: ${data.blocks?.length ?? 0}`,
      "",
      "1. DANH SÁCH CHECK-IN:",
    ];

    if (data.checkins.length === 0) {
      lines.push("   - Không có khách nhận phòng.");
    } else {
      data.checkins.forEach((c, idx) => {
        const tags = [
          BOOKING_TYPE_META[c.bookingType]?.label ?? c.bookingType,
          `${c.numGuests} khách`,
          c.status === "pending" ? "CHỜ XÁC NHẬN" : (c.checkinGuideStatus ?? "pending") !== "pending" ? "Đã gửi HD" : "Chưa gửi HD",
          !c.doorCode && c.status === "confirmed" ? "THIẾU MÃ CỬA" : null,
          (c.remainingAmount ?? 0) > 0 ? `Còn thu ${Number(c.remainingAmount).toLocaleString("vi-VN")}đ` : null,
        ]
          .filter(Boolean)
          .join(" | ");
        lines.push(`   ${idx + 1}. [${formatTimeShort(c.checkinAt)}–${formatTimeShort(c.checkoutAt)}] ${c.roomName} — ${c.guestName} (${tags})`);
        if (c.closingNote) lines.push(`      Chốt đơn: ${c.closingNote}`);
        if (c.note) lines.push(`      Ghi chú: ${c.note}`);
      });
    }

    lines.push("", "2. LỊCH DỌN PHÒNG (THEO GIỜ):");
    if (data.housekeepingTasks.length === 0) {
      lines.push("   - Không có lượt dọn phòng.");
    } else {
      data.housekeepingTasks.forEach((t, idx) => {
        const hkLabel = t.hkStatus === "done" ? "Đã xong" : t.hkStatus === "cleaning" ? "Đang dọn" : "Chưa dọn";
        const kindLabel = t.kind === "owner_stay" ? "Chủ nhà ở" : `Trả phòng${t.lateCheckoutHours > 0 ? ` +${t.lateCheckoutHours}h trễ` : ""}`;
        const nextStr = t.nextCheckin
          ? `${t.urgent ? "GẤP - " : ""}Khách sau ${formatTimeShort(t.nextCheckin.checkinAt)} (${t.nextCheckin.numGuests} khách, còn ${t.nextCheckin.gapMinutes}p)`
          : "Trống sau đó";
        lines.push(`   ${idx + 1}. [${formatTimeShort(t.turnoverStartAt)}–${formatTimeShort(t.turnoverEndAt)}] ${t.roomName} (${kindLabel}) — ${hkLabel} | ${nextStr}`);
        if (t.nextCheckin?.note || t.nextCheckin?.closingNote) {
          lines.push(`      Chuẩn bị khách sau: ${[t.nextCheckin.note, t.nextCheckin.closingNote].filter(Boolean).join(" · ")}`);
        }
      });
    }

    if (data.blocks?.length) {
      lines.push("", "3. PHÒNG ĐANG KHÓA:");
      data.blocks.forEach((b, idx) => {
        lines.push(`   ${idx + 1}. ${b.roomName ?? b.roomId} — ${roomBlockTypeOf(b.blockType).label}: ${b.reason ?? ""} (${formatVn(b.blockedFrom)} → ${formatVn(b.blockedTo)})`);
      });
    }

    const ok = await copyTextSafe(lines.join("\n"));
    if (ok) {
      toast.success(`Đã sao chép báo cáo điều phối ngày ${selectedDate} (đã ẩn mã cửa & SĐT).`, "Đã chép báo cáo");
    } else {
      toast.error("Không sao chép được vào bộ nhớ tạm.");
    }
  };

  const openDetailDrawer = (item: DailyRosterItem) => {
    if (!onSelectBooking) return;
    onSelectBooking({
      id: item.id,
      roomId: item.roomId,
      guestName: item.guestName,
      phone: item.phone,
      instagram: item.instagram,
      facebook: item.facebook,
      zalo: item.zalo,
      numGuests: item.numGuests,
      bookingType: item.bookingType,
      checkinAt: item.checkinAt,
      checkoutAt: item.checkoutAt,
      earlyCheckinHours: item.earlyCheckinHours,
      lateCheckoutHours: item.lateCheckoutHours,
      totalPrice: item.totalPrice,
      remainingAmount: item.remainingAmount,
      paidAmount: item.paidAmount,
      refundAmount: item.refundAmount,
      netPaid: item.netPaid,
      isDeposit: item.isDeposit ? 1 : 0,
      depositStatus: item.depositStatus,
      status: item.status,
      closingNote: item.closingNote,
      note: item.note,
      createdAt: item.createdAt,
      createdByStaffId: item.createdByStaffId,
      createdByStaffName: item.createdByStaffName,
      updatedAt: item.updatedAt,
      updatedByStaffId: item.updatedByStaffId,
      updatedByStaffName: item.updatedByStaffName,
      modNo: item.modNo,
      version: item.modNo,
    });
  };

  if (!isOpen) return null;

  const missingCodesCount = data?.summary.doorCodeMissingCount ?? 0;
  const guideUnsentCount = data?.summary.guideUnsentCount ?? 0;
  const pendingCount = data?.summary.pendingCheckinsCount ?? 0;
  const hkDoneCount = data?.summary.hkDoneCount ?? 0;
  const hkUrgentCount = data?.summary.hkUrgentCount ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-roster-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-5xl bg-slate-50 border border-slate-200 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-5 py-3.5 flex flex-col gap-3 shrink-0">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <div className="min-w-0">
                <h2 id="daily-roster-modal-title" className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
                  Điều phối vận hành ngày
                </h2>
                <p className="text-xs text-slate-600 truncate">
                  Đồng bộ 2 chiều Admin &amp; nhóm Telegram · Múi giờ Việt Nam (UTC+7)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ điều phối ngày"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Date Stepper & Global Utilities */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1.5" role="group" aria-label="Chọn ngày điều phối">
              <button
                type="button"
                onClick={() => setSelectedDate((d) => addDaysYmd(d, -1))}
                aria-label="Ngày trước"
                className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(vnToday)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  selectedDate === vnToday
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(vnTomorrow)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  selectedDate === vnTomorrow
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Ngày mai
              </button>
              <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 tabular-nums">
                {formatDateHeading(selectedDate)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedDate((d) => addDaysYmd(d, 1))}
                aria-label="Ngày sau"
                className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenDoorCodes && (
                <button
                  type="button"
                  onClick={onOpenDoorCodes}
                  className="min-h-[36px] px-3 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/60 text-xs font-bold text-slate-700 hover:text-emerald-900 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>Cài / xem mã cửa</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopySafeDailyReport}
                disabled={!data}
                className="min-h-[36px] px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>Sao chép báo cáo</span>
              </button>
              <button
                type="button"
                onClick={() => fetchRoster(selectedDate)}
                disabled={loading}
                aria-label="Làm mới lịch điều phối"
                className="min-h-[36px] px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <svg className={`w-3.5 h-3.5 text-slate-600 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Làm mới</span>
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading && !data ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200 rounded-xl">
              <Spinner size="lg" />
              <p className="text-sm font-medium text-slate-600">Đang tải lịch điều phối ngày...</p>
            </div>
          ) : loadError && !data ? (
            <div className="p-6 bg-white border border-rose-200 rounded-xl text-center space-y-3">
              <p className="text-sm font-bold text-rose-700">{loadError}</p>
              <button
                type="button"
                onClick={() => fetchRoster(selectedDate)}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
              >
                Thử tải lại
              </button>
            </div>
          ) : (
            <>
              {/* Flat KPI Strip (4 items) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="block text-xs font-semibold text-slate-500">Khách nhận phòng</span>
                  <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl font-extrabold text-slate-900 tabular-nums">{data?.summary.totalCheckins ?? 0}</span>
                    {pendingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 tabular-nums">
                        {pendingCount} chờ xác nhận
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {data?.summary.hourlyCount ?? 0} giờ · {data?.summary.overnightCount ?? 0} đêm · {data?.summary.dayuseCount ?? 0} ngày
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="block text-xs font-semibold text-slate-500">Hướng dẫn &amp; Mã cửa</span>
                  <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                    <span className={`text-xl font-extrabold tabular-nums ${guideUnsentCount > 0 ? "text-emerald-700" : "text-slate-900"}`}>
                      {guideUnsentCount}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">chưa gửi HD</span>
                  </div>
                  <p className={`mt-1 text-xs font-semibold tabular-nums ${missingCodesCount > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {missingCodesCount > 0 ? `${missingCodesCount} đơn thiếu mã cửa` : "Đủ mã cửa các đơn"}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="block text-xs font-semibold text-slate-500">Tiến độ dọn phòng</span>
                  <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                      {hkDoneCount}/{housekeepingTasks.length}
                    </span>
                    {hkUrgentCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
                        {hkUrgentCount} gấp
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Sắp xếp theo giờ trả phòng</p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="block text-xs font-semibold text-slate-500">Khóa phòng trong ngày</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-slate-900 tabular-nums">{blocks.length}</span>
                    <span className="text-xs text-slate-600">phòng tạm đóng</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {blocks.filter((b) => b.blockType === "owner_stay").length} chủ ở · bảo trì / vệ sinh
                  </p>
                </div>
              </div>

              {/* Tabs & Triage Controls */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80 overflow-x-auto">
                    {(
                      [
                        { id: "overview", label: "Toàn cảnh" },
                        { id: "checkin", label: `Check-in (${checkins.length})` },
                        { id: "housekeeping", label: `Dọn phòng (${housekeepingTasks.length})` },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setViewTab(tab.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          viewTab === tab.id ? "bg-white text-emerald-800 shadow-2xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom text search (never input type="search") */}
                  <div className="relative w-full sm:w-72 min-w-0">
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm tên khách, số phòng, SĐT, mã đơn..."
                      className="w-full min-h-[36px] pl-9 pr-8 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        aria-label="Xóa từ khóa tìm kiếm"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Contextual triage filter chips */}
                {viewTab !== "housekeeping" && (
                  <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Lọc nhanh Check-in">
                    <span className="text-xs font-semibold text-slate-500 mr-1">Lọc Check-in:</span>
                    {(
                      [
                        { id: "all", label: "Tất cả" },
                        { id: "unsent", label: "Chưa gửi HD" },
                        { id: "missing_code", label: "Thiếu mã cửa" },
                        { id: "collect", label: "Còn thu tiền" },
                        { id: "pending", label: "Chờ xác nhận" },
                      ] as const
                    ).map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setCheckinFilter(chip.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                          checkinFilter === chip.id
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                {viewTab !== "checkin" && (
                  <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Lọc nhanh Dọn phòng">
                    <span className="text-xs font-semibold text-slate-500 mr-1">Lọc Dọn phòng:</span>
                    {(
                      [
                        { id: "all", label: "Tất cả" },
                        { id: "urgent", label: "Cần dọn gấp" },
                        { id: "pending", label: "Chưa dọn" },
                        { id: "cleaning", label: "Đang dọn" },
                        { id: "done", label: "Đã xong" },
                      ] as const
                    ).map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setHkFilter(chip.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                          hkFilter === chip.id
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 1: Check-in List */}
              {viewTab !== "housekeeping" && (
                <section aria-label="Danh sách khách nhận phòng" className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Danh sách khách nhận phòng ({filteredCheckins.length})
                    </h3>
                  </div>

                  {filteredCheckins.length === 0 ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl text-center">
                      <p className="text-sm font-medium text-slate-600">Không có đơn nhận phòng phù hợp bộ lọc.</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                      {filteredCheckins.map((item) => (
                        <CheckinRow
                          key={item.id}
                          item={item}
                          isCopying={busyActionId === `copy:${item.id}`}
                          isTogglingSent={busyActionId === `sent:${item.id}`}
                          onCopyGuide={() => handleCopyStandardGuide(item)}
                          onToggleSent={() => handleToggleGuideSent(item)}
                          onOpenDetail={() => openDetailDrawer(item)}
                          onOpenDoorCodes={onOpenDoorCodes}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Section 2: Housekeeping Queue (Sorted chronologically, includes owner_stay) */}
              {viewTab !== "checkin" && (
                <section aria-label="Lịch dọn phòng theo giờ" className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Lịch dọn phòng theo thứ tự giờ ({filteredHkTasks.length})
                    </h3>
                  </div>

                  {filteredHkTasks.length === 0 ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl text-center">
                      <p className="text-sm font-medium text-slate-600">Không có lượt dọn phòng phù hợp bộ lọc.</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                      {filteredHkTasks.map((task, idx) => (
                        <HousekeepingRow
                          key={`${task.refId}-${task.checkoutAt}`}
                          index={idx + 1}
                          task={task}
                          isBusy={busyActionId === `hk:${task.refId}`}
                          onSetStatus={(st) => handleSetHkStatus(task, st)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Section 3: Active Room Blocks */}
              {viewTab !== "checkin" && blocks.length > 0 && (
                <section aria-label="Phòng đang khóa trong ngày" className="space-y-2">
                  <h3 className="text-sm font-extrabold text-slate-900 px-1">
                    Phòng đang khóa trong ngày ({blocks.length})
                  </h3>
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                    {blocks.map((bl) => {
                      const bt = roomBlockTypeOf(bl.blockType);
                      return (
                        <div key={String(bl.id)} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-900">{bl.roomName ?? bl.roomId}</span>
                              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {bt.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              {bl.reason || "Không có lý do"}
                              {bl.note ? ` · ${bl.note}` : ""}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                            {formatVn(bl.blockedFrom)} → {formatVn(bl.blockedTo)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── CheckinRow Subcomponent ─────────────────────────────────────────────────────────────────

const CheckinRow: React.FC<{
  item: DailyRosterItem;
  isCopying: boolean;
  isTogglingSent: boolean;
  onCopyGuide: () => void;
  onToggleSent: () => void;
  onOpenDetail: () => void;
  onOpenDoorCodes?: () => void;
}> = ({ item, isCopying, isTogglingSent, onCopyGuide, onToggleSent, onOpenDetail, onOpenDoorCodes }) => {
  const typeMeta = BOOKING_TYPE_META[item.bookingType] ?? { label: item.bookingType, cls: "bg-slate-100 text-slate-700 border-slate-200" };
  const isPending = item.status === "pending";
  const isSent = (item.checkinGuideStatus ?? "pending") !== "pending";
  const hasCodes = Boolean(item.doorCode);
  const missingNames = (item.doorCodeMissing ?? [])
    .map((m) => (m === "gate" ? "mã cổng" : "hộp khóa"))
    .join(" & ");
  const contactParts = [
    item.phone,
    item.instagram ? `IG: ${item.instagram}` : null,
    item.facebook ? `FB: ${item.facebook}` : null,
    item.zalo ? `Zalo: ${item.zalo}` : null,
  ].filter(Boolean);

  return (
    <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Top line: time, room, guest, status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-xs font-bold tabular-nums">
            {formatTimeShort(item.checkinAt)} → {formatTimeShort(item.checkoutAt)}
          </span>
          <span className="text-sm font-extrabold text-slate-900">
            {item.roomName}
          </span>
          <span className="text-sm font-bold text-slate-800">{item.guestName}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${typeMeta.cls}`}>
            {typeMeta.label}
          </span>
          <span className="text-xs font-semibold text-slate-600 tabular-nums">
            {item.numGuests} khách
          </span>
          {item.channel && CHANNEL_LABEL[item.channel] && (
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {CHANNEL_LABEL[item.channel]}
            </span>
          )}
          {isPending && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              Chờ xác nhận
            </span>
          )}
          {(item.remainingAmount ?? 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
              Còn thu {Number(item.remainingAmount).toLocaleString("vi-VN")} đ
            </span>
          )}
        </div>

        {/* Contact & code status */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600">
          {contactParts.length > 0 && <span className="tabular-nums">{contactParts.join(" · ")}</span>}
          <span className="text-slate-400">Mã đơn: {item.id}</span>
        </div>

        {/* Door code + guide status */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {hasCodes ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold tabular-nums">
              {item.doorCode}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
              <span>Thiếu {missingNames || "mã cửa"}</span>
              {onOpenDoorCodes && (
                <button
                  type="button"
                  onClick={onOpenDoorCodes}
                  className="underline font-bold hover:text-rose-900 cursor-pointer"
                >
                  Cài ngay
                </button>
              )}
            </span>
          )}

          {!isPending && (
            isSent ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold tabular-nums">
                {item.checkinGuideStatus === "sent_auto" ? "AI đã gửi HD" : "Đã gửi HD"}
                {item.checkinGuideSentByName ? ` · ${item.checkinGuideSentByName}` : ""}
                {item.checkinGuideSentAt ? ` · ${formatTimeShort(item.checkinGuideSentAt)}` : ""}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                Chưa gửi hướng dẫn
              </span>
            )
          )}
        </div>

        {/* Full notes (closingNote + note) */}
        {(item.closingNote || item.note) && (
          <div className="space-y-1 pt-0.5 text-xs">
            {item.closingNote && (
              <p className="text-slate-700">
                <span className="font-bold text-slate-900">Chốt đơn:</span> {item.closingNote}
              </p>
            )}
            {item.note && (
              <p className="text-amber-900 bg-amber-50/70 border border-amber-200/80 rounded-lg px-2.5 py-1">
                <span className="font-bold">Ghi chú:</span> {item.note}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons (max 3 compact buttons) */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {!isPending && (
          <>
            <button
              type="button"
              onClick={onCopyGuide}
              disabled={isCopying}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>{isCopying ? "Đang tạo..." : "Copy mẫu chuẩn"}</span>
            </button>

            <button
              type="button"
              onClick={onToggleSent}
              disabled={isTogglingSent}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 cursor-pointer ${
                isSent
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {isSent ? "Đã gửi HD" : "Đánh dấu đã gửi"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onOpenDetail}
          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer transition-colors"
        >
          Chi tiết
        </button>
      </div>
    </div>
  );
};

// ── HousekeepingRow Subcomponent ─────────────────────────────────────────────────────────────

const HousekeepingRow: React.FC<{
  index: number;
  task: DailyRosterHousekeepingTask;
  isBusy: boolean;
  onSetStatus: (status: HousekeepingStatus) => void;
}> = ({ index, task, isBusy, onSetStatus }) => {
  const status = task.hkStatus ?? "pending";
  const kindLabel =
    task.kind === "owner_stay"
      ? "Chủ nhà ở"
      : `Trả phòng (${BOOKING_TYPE_META[task.bookingType ?? "hourly"]?.label ?? ""})`;

  return (
    <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center tabular-nums shrink-0">
            {index}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-xs font-bold tabular-nums">
            {formatTimeShort(task.turnoverStartAt)} – {formatTimeShort(task.turnoverEndAt)}
          </span>
          <span className="text-sm font-extrabold text-slate-900">{task.roomName}</span>
          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {kindLabel}
          </span>
          {task.lateCheckoutHours > 0 && (
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 tabular-nums">
              +{task.lateCheckoutHours}h trễ
            </span>
          )}
          {task.urgent && status !== "done" && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300 tabular-nums">
              Cần dọn gấp · còn {task.nextCheckin?.gapMinutes ?? 0} phút
            </span>
          )}
        </div>

        {/* Next guest turnaround details */}
        <div className="text-xs text-slate-700 space-y-1">
          {task.nextCheckin ? (
            <p className="tabular-nums">
              <span className="font-bold text-slate-900">Khách kế tiếp:</span>{" "}
              {formatTimeShort(task.nextCheckin.checkinAt)} ({task.nextCheckin.numGuests} khách · cách {task.nextCheckin.gapMinutes} phút)
              {task.nextCheckin.status === "pending" ? " · Chờ xác nhận" : ""}
              {[task.nextCheckin.note, task.nextCheckin.closingNote].filter(Boolean).length > 0
                ? ` — Chuẩn bị: ${[task.nextCheckin.note, task.nextCheckin.closingNote].filter(Boolean).join(" · ")}`
                : ""}
            </p>
          ) : (
            <p className="text-slate-500">Chưa có khách kế tiếp trong 24 giờ.</p>
          )}

          {[task.note, task.closingNote].filter(Boolean).length > 0 && (
            <p className="text-slate-600">
              <span className="font-semibold text-slate-800">Lưu ý lượt trả:</span>{" "}
              {[task.note, task.closingNote].filter(Boolean).join(" · ")}
            </p>
          )}

          {task.hkUpdatedAt && task.hkUpdatedByName && (
            <p className="text-emerald-800 font-semibold tabular-nums">
              Cập nhật: {task.hkUpdatedByName} · {formatTimeShort(task.hkUpdatedAt)}
            </p>
          )}
        </div>
      </div>

      {/* 2-way Housekeeping 3-state segmented toggle */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 self-start lg:self-center" role="group" aria-label={`Trạng thái dọn phòng ${task.roomName}`}>
        {(
          [
            { id: "pending", label: "Chưa dọn", activeCls: "bg-white text-slate-900 border-slate-300 shadow-2xs" },
            { id: "cleaning", label: "Đang dọn", activeCls: "bg-amber-600 text-white border-amber-600 shadow-2xs" },
            { id: "done", label: "Đã xong", activeCls: "bg-emerald-600 text-white border-emerald-600 shadow-2xs" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={isBusy}
            onClick={() => onSetStatus(opt.id)}
            className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-bold border transition-colors disabled:opacity-50 cursor-pointer ${
              status === opt.id ? opt.activeCls : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
