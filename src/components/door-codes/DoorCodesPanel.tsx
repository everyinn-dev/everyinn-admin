"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  agentApi,
  AgentApiError,
  formatVnTime,
  type BookingDoorCodeResult,
  type DoorCodeAuditItem,
  type DoorCodeAuditTargetType,
  type DoorCodeGateItem,
  type DoorCodeLockboxItem,
} from "@/lib/agentApi";
import {
  addDaysYmd,
  chunkArray,
  findGateCodesForVnDate,
  formatBookingDoorCodeCopyText,
  normalizeDoorCode,
  ROOM_BY_ID,
  ROOM_CATALOG,
  vnDateRangeToIso,
} from "@/lib/doorCodeUtils";
import { getVnToday } from "@/lib/timelineUtils";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { GanttBookingItem, GanttDataResponse, GanttRoomData } from "@/types";

export interface DoorCodesPanelProps {
  isManager: boolean;
  /** Initial VN date (YYYY-MM-DD); defaults to today VN time. */
  initialDate?: string;
  /** Reuse already-loaded Gantt rooms from Dashboard when matching `initialDate`. */
  preloadedDate?: string;
  preloadedRooms?: GanttRoomData[];
  onChanged?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

type PanelTab = "daily" | "vault" | "audit";
type DailyFilter = "all" | "override" | "missing";

interface DayBookingRow {
  booking: GanttBookingItem;
  room: GanttRoomData;
}

async function writeClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  if (typeof document !== "undefined") {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      document.body.removeChild(el);
    }
  }
  return false;
}

function generatePinCandidate(): string {
  const arr = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    arr[0] = Math.floor(Math.random() * 9000) + 1000;
  }
  const n = 1000 + (arr[0]! % 9000);
  return `${n}#`;
}

function formatVnDateLabel(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [, m, d] = ymd.split("-");
  const dateObj = new Date(`${ymd}T12:00:00+07:00`);
  const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return `${weekdays[dateObj.getDay()]}, ${d}/${m}/${ymd.slice(0, 4)}`;
}

function endOfMonthYmd(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  if (!y || !m) return ymd;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function CopyButton({
  copied,
  disabled,
  label = "Copy",
  onClick,
  size = "sm",
  ariaLabel,
}: {
  copied: boolean;
  disabled?: boolean;
  label?: string;
  onClick: () => void;
  size?: "xs" | "sm";
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-1 rounded-lg border font-semibold transition-all cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
        size === "xs" ? "min-h-[34px] px-2.5 text-xs" : "min-h-[38px] px-3 text-xs"
      } ${
        copied
          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
          : "bg-white text-slate-700 border-slate-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 active:scale-[0.98]"
      }`}
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
      <span>{copied ? "Đã copy" : label}</span>
    </button>
  );
}

const STATE_BADGE: Record<DoorCodeGateItem["state"], { cls: string; label: string }> = {
  current: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", label: "Đang hiệu lực" },
  scheduled: { cls: "bg-sky-50 text-sky-800 border-sky-200", label: "Sắp áp dụng" },
  expired: { cls: "bg-slate-100 text-slate-600 border-slate-200", label: "Đã hết hạn" },
  inactive: { cls: "bg-slate-100 text-slate-500 border-slate-200", label: "Đã tắt" },
};

const AUDIT_ACTION_META: Record<DoorCodeAuditItem["action"], { label: string; cls: string }> = {
  gate_create: { label: "Tạo mã cổng", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  gate_auto_close: { label: "Đóng mã cổng cũ", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  gate_deactivate: { label: "Tắt mã cổng", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  lockbox_upsert: { label: "Đổi mã hộp khóa", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  override_upsert: { label: "Đặt mã riêng đơn", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  override_delete: { label: "Gỡ mã riêng đơn", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

export const DoorCodesPanel: React.FC<DoorCodesPanelProps> = ({
  isManager,
  initialDate,
  preloadedDate,
  preloadedRooms,
  onChanged,
  onDirtyChange,
}) => {
  const toast = useToast();
  const vnToday = useMemo(() => getVnToday(), []);
  const startDate = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : vnToday;

  const [activeTab, setActiveTab] = useState<PanelTab>("daily");
  const [selectedDate, setSelectedDate] = useState<string>(startDate);
  const [reveal, setReveal] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dailyFilter, setDailyFilter] = useState<DailyFilter>("all");

  // Shared vault state
  const [gates, setGates] = useState<DoorCodeGateItem[]>([]);
  const [lockboxes, setLockboxes] = useState<DoorCodeLockboxItem[]>([]);
  const [vaultLoading, setVaultLoading] = useState<boolean>(true);
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Day bookings + batch door-code resolutions
  const [dayRooms, setDayRooms] = useState<GanttRoomData[]>(() =>
    preloadedRooms && preloadedDate === startDate ? preloadedRooms : [],
  );
  const [dayRoomsDate, setDayRoomsDate] = useState<string | null>(() =>
    preloadedRooms && preloadedDate === startDate ? startDate : null,
  );
  const [dayLoading, setDayLoading] = useState<boolean>(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [resolvedByBooking, setResolvedByBooking] = useState<Record<string, BookingDoorCodeResult>>({});
  const initialPreloadConsumedRef = useRef<boolean>(false);

  // Audit state (manager-only tab)
  const [auditLogs, setAuditLogs] = useState<DoorCodeAuditItem[]>([]);
  const [auditFilter, setAuditFilter] = useState<"all" | DoorCodeAuditTargetType>("all");
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Copy feedback indicator key -> timeout
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCopyFeedback = useCallback((key: string, message: string) => {
    setCopiedKey(key);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedKey(null), 1800);
    toast.success(message, "Đã sao chép");
  }, [toast]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Per-booking override inline editor state (manager only)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [overrideInput, setOverrideInput] = useState<string>("");
  const [overrideNoteInput, setOverrideNoteInput] = useState<string>("");
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSaving, setOverrideSaving] = useState<boolean>(false);
  const [confirmDeleteOverrideId, setConfirmDeleteOverrideId] = useState<string | null>(null);

  // Date-range gate code creator state (manager only)
  const [gateScopeMode, setGateScopeMode] = useState<"range" | "open">("range");
  const [gateCodeInput, setGateCodeInput] = useState<string>("");
  const [gateLabelInput, setGateLabelInput] = useState<string>("");
  const [gateFromDate, setGateFromDate] = useState<string>(startDate);
  const [gateToDate, setGateToDate] = useState<string>(startDate);
  const [gateCustomTime, setGateCustomTime] = useState<boolean>(false);
  const [gateFromTime, setGateFromTime] = useState<string>("00:00");
  const [gateToTime, setGateToTime] = useState<string>("23:59");
  const [gateFormError, setGateFormError] = useState<string | null>(null);
  const [gateSaving, setGateSaving] = useState<boolean>(false);
  const [showInactiveGates, setShowInactiveGates] = useState<boolean>(false);

  // Lockbox inline editor state (manager only)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState<string>("");
  const [roomCodeError, setRoomCodeError] = useState<string | null>(null);
  const [roomSavingId, setRoomSavingId] = useState<string | null>(null);

  // Track unsaved inputs to protect modal against accidental backdrop dismissal
  useEffect(() => {
    if (!onDirtyChange) return;
    const dirty = Boolean(
      isManager &&
        (overrideInput.trim() ||
          overrideNoteInput.trim() ||
          gateCodeInput.trim() ||
          gateLabelInput.trim() ||
          roomCodeInput.trim()),
    );
    onDirtyChange(dirty);
  }, [isManager, overrideInput, overrideNoteInput, gateCodeInput, gateLabelInput, roomCodeInput, onDirtyChange]);

  const loadVault = useCallback(async () => {
    setVaultLoading(true);
    setVaultError(null);
    try {
      const qs = new URLSearchParams();
      if (reveal) qs.set("reveal", "1");
      if (showInactiveGates) qs.set("all", "1");
      const query = qs.toString();
      const res = await agentApi<{ gateCodes: DoorCodeGateItem[]; lockboxes: DoorCodeLockboxItem[] }>(
        `door-codes${query ? `?${query}` : ""}`,
      );
      setGates(res.data?.gateCodes ?? []);
      setLockboxes(res.data?.lockboxes ?? []);
    } catch (err) {
      setVaultError(err instanceof AgentApiError ? err.message : "Không tải được kho mã cửa.");
    } finally {
      setVaultLoading(false);
    }
  }, [reveal, showInactiveGates]);

  // Extract non-cancelled bookings touching the selected day
  const dayBookingRows: DayBookingRow[] = useMemo(() => {
    const seen = new Set<string>();
    const list: DayBookingRow[] = [];
    for (const room of dayRooms) {
      for (const b of room.bookings) {
        if (b.status === "cancelled") continue;
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        list.push({ booking: b, room });
      }
    }
    list.sort((a, b) => {
      const timeDiff = Date.parse(a.booking.checkinAt) - Date.parse(b.booking.checkinAt);
      if (timeDiff !== 0) return timeDiff;
      return a.room.roomNumber.localeCompare(b.room.roomNumber);
    });
    return list;
  }, [dayRooms]);

  const resolveBookingsForDay = useCallback(
    async (rows: readonly DayBookingRow[], withReveal: boolean) => {
      if (rows.length === 0) {
        setResolvedByBooking({});
        return;
      }
      const stays = rows.map(({ booking, room }) => ({
        bookingId: booking.id,
        roomId: booking.roomId || room.id,
        checkinAt: new Date(booking.checkinAt).toISOString(),
        checkoutAt: new Date(booking.checkoutAt).toISOString(),
      }));
      const chunks = chunkArray(stays, 20);
      const map: Record<string, BookingDoorCodeResult> = {};
      for (const chunk of chunks) {
        const res = await agentApi<{ results: BookingDoorCodeResult[] }>("door-codes/resolve-batch", {
          method: "POST",
          body: { stays: chunk, reveal: withReveal },
        });
        for (const item of res.data?.results ?? []) {
          map[item.bookingId] = item;
        }
      }
      setResolvedByBooking(map);
    },
    [],
  );

  const loadDaySchedule = useCallback(
    async (targetDate: string, forceGantt = false) => {
      if (!forceGantt && !initialPreloadConsumedRef.current && preloadedRooms && preloadedDate === targetDate) {
        initialPreloadConsumedRef.current = true;
        setDayRooms(preloadedRooms);
        setDayRoomsDate(targetDate);
        return;
      }
      setDayLoading(true);
      setDayError(null);
      try {
        const ganttRes = await apiFetch(`/api/dashboard/gantt?date=${encodeURIComponent(targetDate)}&_t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!ganttRes.ok) {
          throw new Error("Không tải được danh sách booking của ngày này.");
        }
        const payload = (await ganttRes.json()) as GanttDataResponse;
        setDayRooms(payload.rooms ?? []);
        setDayRoomsDate(targetDate);
      } catch (err) {
        setDayError(err instanceof Error ? err.message : "Không tải được dữ liệu booking theo ngày.");
      } finally {
        setDayLoading(false);
      }
    },
    [preloadedDate, preloadedRooms],
  );

  const loadAuditLogs = useCallback(async () => {
    if (!isManager) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const qs = new URLSearchParams({ limit: "50" });
      if (auditFilter !== "all") qs.set("targetType", auditFilter);
      const res = await agentApi<{ logs: DoorCodeAuditItem[] }>(`door-codes/audit?${qs.toString()}`);
      setAuditLogs(res.data?.logs ?? []);
    } catch (err) {
      setAuditError(err instanceof AgentApiError ? err.message : "Không tải được nhật ký mã cửa.");
    } finally {
      setAuditLoading(false);
    }
  }, [isManager, auditFilter]);

  // Initial & reactive loads
  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  useEffect(() => {
    void loadDaySchedule(selectedDate, false);
  }, [selectedDate, loadDaySchedule]);

  useEffect(() => {
    if (dayRoomsDate !== selectedDate) return;
    let cancelled = false;
    void resolveBookingsForDay(dayBookingRows, reveal)
      .then(() => {
        if (!cancelled) setDayError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setDayError(err instanceof AgentApiError ? err.message : "Không giải mã được mã cửa theo booking.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dayBookingRows, dayRoomsDate, selectedDate, reveal, resolveBookingsForDay]);

  useEffect(() => {
    if (activeTab === "audit" && isManager) {
      void loadAuditLogs();
    }
  }, [activeTab, isManager, loadAuditLogs]);

  const refreshAll = async () => {
    await Promise.all([
      loadVault(),
      loadDaySchedule(selectedDate, true),
      ...(activeTab === "audit" && isManager ? [loadAuditLogs()] : []),
    ]);
  };

  // Copy helpers: if reveal === false, fetch single reveal on-demand before writing to clipboard
  const handleCopyBookingPart = async (
    row: DayBookingRow,
    part: "gate" | "lockbox" | "both",
    key: string,
  ) => {
    let gateCode = resolvedByBooking[row.booking.id]?.gateCode ?? null;
    let lockboxCode = resolvedByBooking[row.booking.id]?.lockboxCode ?? null;

    if (!reveal) {
      try {
        const qs = new URLSearchParams({
          roomId: row.booking.roomId || row.room.id,
          checkinAt: new Date(row.booking.checkinAt).toISOString(),
          checkoutAt: new Date(row.booking.checkoutAt).toISOString(),
          reveal: "1",
        });
        const res = await agentApi<BookingDoorCodeResult>(
          `bookings/${encodeURIComponent(row.booking.id)}/door-code?${qs.toString()}`,
        );
        gateCode = res.data?.gateCode ?? null;
        lockboxCode = res.data?.lockboxCode ?? null;
      } catch {
        toast.error("Không lấy được mã đầy đủ để sao chép.");
        return;
      }
    }

    const text =
      part === "gate"
        ? gateCode
        : part === "lockbox"
          ? lockboxCode
          : formatBookingDoorCodeCopyText({
              roomNumber: row.room.roomNumber,
              gateCode,
              lockboxCode,
            });
    if (!text) {
      toast.error("Chưa có mã để sao chép.");
      return;
    }
    const ok = await writeClipboard(text);
    if (ok) {
      triggerCopyFeedback(
        key,
        part === "both" ? `Đã sao chép mã P.${row.room.roomNumber}` : `Đã sao chép: ${part === "gate" ? "Mã cổng" : "Mã hộp khóa"}`,
      );
    } else {
      toast.error("Trình duyệt không hỗ trợ sao chép tự động.");
    }
  };

  const handleCopyVaultCode = async (kind: "gate" | "lockbox", idOrRoomId: string, displayedCode: string | null, key: string) => {
    let codeToCopy = reveal ? displayedCode : null;
    if (!reveal) {
      try {
        const res = await agentApi<{ gateCodes: DoorCodeGateItem[]; lockboxes: DoorCodeLockboxItem[] }>("door-codes?reveal=1&all=1");
        if (kind === "gate") {
          codeToCopy = res.data?.gateCodes.find((g) => g.id === idOrRoomId)?.code ?? null;
        } else {
          codeToCopy = res.data?.lockboxes.find((l) => l.roomId === idOrRoomId)?.code ?? null;
        }
      } catch {
        toast.error("Không lấy được mã để sao chép.");
        return;
      }
    }
    if (!codeToCopy) {
      toast.error("Chưa có mã để sao chép.");
      return;
    }
    const ok = await writeClipboard(codeToCopy);
    if (ok) {
      triggerCopyFeedback(key, kind === "gate" ? "Đã sao chép mã cổng" : "Đã sao chép mã hộp khóa");
    } else {
      toast.error("Không sao chép được.");
    }
  };

  // Manager write handlers
  const handleSaveBookingOverride = async (bookingId: string) => {
    if (!isManager) return;
    const normalized = normalizeDoorCode(overrideInput);
    if (!normalized) {
      setOverrideError("Mã chỉ gồm số 0-9, * hoặc #, độ dài 3 đến 12 ký tự (VD: 2580#).");
      return;
    }
    setOverrideSaving(true);
    setOverrideError(null);
    try {
      const res = await agentApi<{ releasedSchedules?: number }>(
        `bookings/${encodeURIComponent(bookingId)}/door-code`,
        {
          method: "PUT",
          body: {
            gateCode: normalized,
            note: overrideNoteInput.trim() || "Mã cổng riêng theo đơn",
          },
        },
      );
      toast.success(
        `Đã lưu mã cổng riêng.${res.data?.releasedSchedules ? ` Đã gửi ${res.data.releasedSchedules} hướng dẫn đang chờ.` : ""}`,
      );
      setEditingBookingId(null);
      setOverrideInput("");
      setOverrideNoteInput("");
      setConfirmDeleteOverrideId(null);
      await resolveBookingsForDay(dayBookingRows, reveal);
      onChanged?.();
    } catch (err) {
      const msg = err instanceof AgentApiError ? err.message : "Không lưu được mã cổng riêng.";
      setOverrideError(msg);
      toast.error(msg);
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleDeleteBookingOverride = async (bookingId: string) => {
    if (!isManager) return;
    setOverrideSaving(true);
    try {
      await agentApi(`bookings/${encodeURIComponent(bookingId)}/door-code`, { method: "DELETE" });
      toast.success("Đã gỡ mã riêng. Booking quay về dùng mã cổng chung.");
      setConfirmDeleteOverrideId(null);
      if (editingBookingId === bookingId) {
        setEditingBookingId(null);
        setOverrideInput("");
        setOverrideNoteInput("");
      }
      await resolveBookingsForDay(dayBookingRows, reveal);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof AgentApiError ? err.message : "Không gỡ được mã riêng.");
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleCreateGateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;
    const normalized = normalizeDoorCode(gateCodeInput);
    if (!normalized) {
      setGateFormError("Mã chỉ gồm số 0-9, * hoặc #, độ dài 3 đến 12 ký tự (VD: 2580#).");
      return;
    }

    let validFrom: string | undefined;
    let validUntil: string | undefined;
    if (gateScopeMode === "range") {
      const fromTime = gateCustomTime ? gateFromTime : "00:00";
      const toTime = gateCustomTime ? gateToTime : "23:59";
      const converted = vnDateRangeToIso(gateFromDate, gateToDate, fromTime, toTime);
      if (!converted) {
        setGateFormError("Khoảng ngày hoặc giờ kết thúc phải sau thời điểm bắt đầu.");
        return;
      }
      validFrom = converted.validFrom;
      validUntil = converted.validUntil;
    }

    setGateSaving(true);
    setGateFormError(null);
    try {
      const res = await agentApi<{ releasedSchedules?: number }>("door-codes/gate", {
        method: "POST",
        body: {
          code: normalized,
          label: gateLabelInput.trim() || undefined,
          validFrom,
          validUntil,
        },
      });
      toast.success(
        `Đã lưu mã cổng mới.${res.data?.releasedSchedules ? ` Đã gửi ${res.data.releasedSchedules} hướng dẫn đang chờ.` : ""}`,
      );
      setGateCodeInput("");
      setGateLabelInput("");
      await Promise.all([loadVault(), resolveBookingsForDay(dayBookingRows, reveal)]);
      onChanged?.();
    } catch (err) {
      const msg = err instanceof AgentApiError ? err.message : "Không lưu được mã cổng.";
      setGateFormError(msg);
      toast.error(msg);
    } finally {
      setGateSaving(false);
    }
  };

  const handleDeactivateGateCode = async (id: string) => {
    if (!isManager) return;
    try {
      await agentApi(`door-codes/gate/${encodeURIComponent(id)}/deactivate`, { method: "POST" });
      toast.success("Đã tắt mã cổng.");
      await Promise.all([loadVault(), resolveBookingsForDay(dayBookingRows, reveal)]);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof AgentApiError ? err.message : "Không tắt được mã cổng.");
    }
  };

  const handleSaveLockbox = async (roomId: string) => {
    if (!isManager) return;
    const normalized = normalizeDoorCode(roomCodeInput);
    if (!normalized) {
      setRoomCodeError("Mã hộp khóa chỉ gồm số 0-9, * hoặc #, dài 3 đến 12 ký tự.");
      return;
    }
    setRoomSavingId(roomId);
    setRoomCodeError(null);
    try {
      const res = await agentApi<{ releasedSchedules?: number }>(`door-codes/lockbox/${encodeURIComponent(roomId)}`, {
        method: "PUT",
        body: { code: normalized },
      });
      toast.success(
        `Đã cập nhật mã hộp khóa.${res.data?.releasedSchedules ? ` Đã gửi ${res.data.releasedSchedules} hướng dẫn đang chờ.` : ""}`,
      );
      setEditingRoomId(null);
      setRoomCodeInput("");
      await Promise.all([loadVault(), resolveBookingsForDay(dayBookingRows, reveal)]);
      onChanged?.();
    } catch (err) {
      const msg = err instanceof AgentApiError ? err.message : "Không lưu được mã hộp khóa.";
      setRoomCodeError(msg);
      toast.error(msg);
    } finally {
      setRoomSavingId(null);
    }
  };

  // Derived data for Tab 1 summary & filters
  const activeDayGates = useMemo(() => findGateCodesForVnDate(gates, selectedDate), [gates, selectedDate]);
  const primaryDayGate = activeDayGates[0] ?? null;

  const dailySummary = useMemo(() => {
    let overrideCount = 0;
    let missingCount = 0;
    for (const row of dayBookingRows) {
      const res = resolvedByBooking[row.booking.id];
      if (res?.resolved.gate?.source === "override") overrideCount++;
      if (res && res.resolved.missing.length > 0) missingCount++;
    }
    return { total: dayBookingRows.length, overrideCount, missingCount };
  }, [dayBookingRows, resolvedByBooking]);

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dayBookingRows.filter(({ booking, room }) => {
      const res = resolvedByBooking[booking.id];
      if (dailyFilter === "override" && res?.resolved.gate?.source !== "override") return false;
      if (dailyFilter === "missing" && !(res && res.resolved.missing.length > 0)) return false;
      if (!q) return true;
      const roomText = `${room.roomNumber} ${room.name} ${booking.roomId}`.toLowerCase();
      return (
        booking.guestName.toLowerCase().includes(q) ||
        booking.phone.toLowerCase().includes(q) ||
        booking.id.toLowerCase().includes(q) ||
        roomText.includes(q) ||
        (res?.overrideNote ?? "").toLowerCase().includes(q)
      );
    });
  }, [dayBookingRows, resolvedByBooking, dailyFilter, searchQuery]);

  const rangePreviewText = useMemo(() => {
    if (gateScopeMode === "open") {
      return "Hiệu lực ngay khi lưu đến khi tạo mã không giới hạn tiếp theo.";
    }
    const fromTime = gateCustomTime ? gateFromTime : "00:00";
    const toTime = gateCustomTime ? gateToTime : "23:59";
    return `Hiệu lực (giờ VN): ${fromTime} ngày ${gateFromDate.slice(8, 10)}/${gateFromDate.slice(5, 7)} → ${toTime} ngày ${gateToDate.slice(8, 10)}/${gateToDate.slice(5, 7)}`;
  }, [gateScopeMode, gateCustomTime, gateFromTime, gateToTime, gateFromDate, gateToDate]);

  const lockboxByRoomId = useMemo(() => new Map(lockboxes.map((l) => [l.roomId, l])), [lockboxes]);

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Role notice + Segmented Tabs + Privacy Toggle + Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Chế độ quản lý mã cửa"
          className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 overflow-x-auto max-w-full"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "daily"}
            onClick={() => setActiveTab("daily")}
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[36px] ${
              activeTab === "daily"
                ? "bg-white text-emerald-800 border border-slate-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Theo ngày & Booking
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "vault"}
            onClick={() => setActiveTab("vault")}
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[36px] ${
              activeTab === "vault"
                ? "bg-white text-emerald-800 border border-slate-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {isManager ? "Khoảng ngày & Hộp khóa" : "Mã cổng & Hộp khóa"}
          </button>
          {isManager && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "audit"}
              onClick={() => setActiveTab("audit")}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[36px] ${
                activeTab === "audit"
                  ? "bg-white text-emerald-800 border border-slate-200 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Nhật ký mã
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <button
            type="button"
            aria-pressed={reveal}
            onClick={() => setReveal((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
              reveal
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {reveal ? (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
            <span>{reveal ? "Đang hiện số" : "Đang che số"}</span>
          </button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshAll()}
            disabled={vaultLoading || dayLoading}
            className="min-h-[38px]"
          >
            <svg
              className={`w-4 h-4 ${vaultLoading || dayLoading ? "animate-spin text-emerald-600" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* Vault Connection Error */}
      {vaultError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-800">
          <span>{vaultError}</span>
          <Button type="button" variant="danger" size="sm" onClick={() => void loadVault()}>
            Thử lại
          </Button>
        </div>
      )}

      {/* ──────────────────── TAB 1: THEO NGÀY & BOOKING ──────────────────── */}
      {activeTab === "daily" && (
        <div className="space-y-4">
          {/* Date Selector Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl bg-white border border-slate-200 p-0.5 shadow-2xs">
                <button
                  type="button"
                  aria-label="Ngày trước"
                  onClick={() => setSelectedDate(addDaysYmd(selectedDate, -1))}
                  className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <label htmlFor="door-codes-date" className="sr-only">
                  Chọn ngày xem mã cửa
                </label>
                <input
                  id="door-codes-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDate(e.target.value);
                  }}
                  className="px-2 py-1 text-base sm:text-sm font-bold text-slate-800 bg-transparent focus:outline-none tabular-nums"
                />
                <button
                  type="button"
                  aria-label="Ngày sau"
                  onClick={() => setSelectedDate(addDaysYmd(selectedDate, 1))}
                  className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {selectedDate !== vnToday && (
                <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedDate(vnToday)}>
                  Hôm nay
                </Button>
              )}

              <span className="text-xs font-semibold text-slate-700 capitalize">{formatVnDateLabel(selectedDate)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold tabular-nums">
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
                {dailySummary.total} booking
              </span>
              {dailySummary.overrideCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                  {dailySummary.overrideCount} mã riêng
                </span>
              )}
              {dailySummary.missingCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                  {dailySummary.missingCount} thiếu mã
                </span>
              )}
            </div>
          </div>

          {/* Active Shared Gate Pass Hero Card for Selected Date */}
          {primaryDayGate ? (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white">
                    Mã cổng chung theo ngày
                  </span>
                  {primaryDayGate.label && (
                    <span className="text-xs font-semibold text-emerald-900">{primaryDayGate.label}</span>
                  )}
                  {activeDayGates.length > 1 && (
                    <span className="text-[11px] font-medium text-emerald-800">
                      (Có {activeDayGates.length} mã theo khung giờ trong ngày)
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-900/80 tabular-nums">
                  Áp dụng: {formatVnTime(primaryDayGate.validFrom)} →{" "}
                  {primaryDayGate.validUntil ? formatVnTime(primaryDayGate.validUntil) : "đến khi đổi mã mới"} • Nguồn:{" "}
                  {primaryDayGate.source === "telegram" ? "Telegram" : "Quản trị web"}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                <div className="px-3.5 py-1.5 rounded-xl bg-white border border-emerald-300 font-mono text-xl font-extrabold tracking-widest text-slate-900 tabular-nums shadow-2xs">
                  {primaryDayGate.code}
                </div>
                <CopyButton
                  copied={copiedKey === `day-gate-${primaryDayGate.id}`}
                  ariaLabel="Sao chép mã cổng chung của ngày"
                  onClick={() =>
                    void handleCopyVaultCode("gate", primaryDayGate.id, primaryDayGate.code, `day-gate-${primaryDayGate.id}`)
                  }
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs text-amber-900 space-y-0.5">
                <p className="font-bold">Chưa có mã cổng chung cho ngày {formatVnDateLabel(selectedDate)}</p>
                <p className="text-amber-800">
                  {isManager
                    ? "Bạn có thể đặt mã cổng dùng chung theo khoảng ngày hoặc đặt mã riêng cho từng booking bên dưới."
                    : "Vui lòng kiểm tra mã riêng của từng booking bên dưới hoặc báo quản lý cập nhật mã cổng."}
                </p>
              </div>
              {isManager && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setGateScopeMode("range");
                    setGateFromDate(selectedDate);
                    setGateToDate(selectedDate);
                    setActiveTab("vault");
                  }}
                >
                  Đặt pass khoảng ngày
                </Button>
              )}
            </div>
          )}

          {/* Search & Quick Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-0">
              <label htmlFor="door-code-search" className="sr-only">
                Tìm kiếm booking theo tên khách, phòng hoặc ghi chú
              </label>
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="door-code-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên khách, số phòng (101, 202...), SĐT hoặc mã đơn..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 bg-white text-base sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 px-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(
                [
                  { id: "all", label: `Tất cả (${dailySummary.total})` },
                  { id: "override", label: `Có mã riêng (${dailySummary.overrideCount})` },
                  { id: "missing", label: `Thiếu mã (${dailySummary.missingCount})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDailyFilter(f.id)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[38px] ${
                    dailyFilter === f.id
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Booking List */}
          {dayError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
              <span>{dayError}</span>
              <Button type="button" size="sm" variant="danger" onClick={() => void loadDaySchedule(selectedDate, true)}>
                Tải lại
              </Button>
            </div>
          ) : dayLoading && dayBookingRows.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50">
              <Spinner size="md" />
              <p className="text-xs text-slate-500 font-medium">Đang tải danh sách booking và mã cửa...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 space-y-1">
              <p className="text-sm font-bold text-slate-700">
                {dayBookingRows.length === 0
                  ? `Không có booking hoạt động trong ngày ${formatVnDateLabel(selectedDate)}`
                  : "Không có booking nào khớp bộ lọc hiện tại"}
              </p>
              <p className="text-xs text-slate-500">
                {dayBookingRows.length === 0
                  ? "Bạn có thể chọn ngày khác hoặc chuyển sang tab Khoảng ngày & Hộp khóa để xem và cài đặt mã chung."
                  : "Thử xóa bộ lọc hoặc đổi từ khóa tìm kiếm."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((row) => {
                const { booking, room } = row;
                const res = resolvedByBooking[booking.id];
                const isOverride = res?.resolved.gate?.source === "override";
                const gateMissing = res?.resolved.missing.includes("gate") ?? false;
                const lockboxMissing = res?.resolved.missing.includes("lockbox") ?? false;
                const isEditingThis = editingBookingId === booking.id;
                const roomMeta = ROOM_BY_ID.get(booking.roomId || room.id);

                return (
                  <div
                    key={booking.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isOverride
                        ? "bg-amber-50/40 border-amber-300 shadow-2xs"
                        : "bg-white border-slate-200 shadow-2xs"
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${
                            (roomMeta?.roomClass ?? room.roomClass) === "haven"
                              ? "bg-sky-50 text-sky-800 border-sky-200"
                              : "bg-purple-50 text-purple-800 border-purple-200"
                          }`}
                        >
                          P.{room.roomNumber}
                        </span>
                        <span className="text-sm font-bold text-slate-900 truncate">{booking.guestName}</span>
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums">{booking.id}</span>
                        {isOverride ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            Mã riêng booking
                          </span>
                        ) : res?.resolved.gate?.source === "vault" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Mã chung
                          </span>
                        ) : res ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Chưa có mã cổng
                          </span>
                        ) : null}
                      </div>

                      <div className="text-xs text-slate-600 tabular-nums shrink-0">
                        {formatVnTime(booking.checkinAt)} → {formatVnTime(booking.checkoutAt)}
                      </div>
                    </div>

                    {/* Prominent Override Note Banner so receptionists immediately spot per-booking passes */}
                    {isOverride && (
                      <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-100/80 border border-amber-300 text-xs text-amber-950 flex items-start gap-2">
                        <svg className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <span className="font-bold">Lưu ý: Booking này có mã cổng riêng. </span>
                          <span>{res?.overrideNote ? `Ghi chú: ${res.overrideNote}` : "Gửi đúng mã riêng dưới đây thay vì mã chung."}</span>
                        </div>
                      </div>
                    )}

                    {/* Codes Grid + Copy Buttons */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Gate code box */}
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-500">
                            {isOverride ? "Pass cổng (Mã riêng)" : "Pass cổng (Dùng chung)"}
                          </p>
                          <p
                            className={`font-mono text-base font-extrabold tracking-wider tabular-nums mt-0.5 ${
                              gateMissing ? "text-rose-700 text-xs font-sans" : "text-slate-900"
                            }`}
                          >
                            {gateMissing
                              ? "Chưa có mã cổng"
                              : res
                                ? reveal
                                  ? res.gateCode ?? "Chưa có"
                                  : "••••"
                                : "Đang tải..."}
                          </p>
                          {!isOverride && res?.gateMeta?.label && (
                            <p className="text-[11px] text-slate-500 truncate">{res.gateMeta.label}</p>
                          )}
                        </div>
                        <CopyButton
                          size="xs"
                          disabled={gateMissing || !res?.resolved.gate}
                          copied={copiedKey === `b-gate-${booking.id}`}
                          ariaLabel={`Sao chép mã cổng cho ${booking.guestName} phòng ${room.roomNumber}`}
                          onClick={() => void handleCopyBookingPart(row, "gate", `b-gate-${booking.id}`)}
                        />
                      </div>

                      {/* Lockbox code box */}
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-500">Hộp khóa P.{room.roomNumber}</p>
                          <p
                            className={`font-mono text-base font-extrabold tracking-wider tabular-nums mt-0.5 ${
                              lockboxMissing ? "text-amber-700 text-xs font-sans" : "text-slate-900"
                            }`}
                          >
                            {lockboxMissing
                              ? "Chưa cài mã"
                              : res
                                ? reveal
                                  ? res.lockboxCode ?? "Chưa có"
                                  : "••••"
                                : "Đang tải..."}
                          </p>
                        </div>
                        <CopyButton
                          size="xs"
                          disabled={lockboxMissing || !res?.resolved.lockbox}
                          copied={copiedKey === `b-box-${booking.id}`}
                          ariaLabel={`Sao chép mã hộp khóa phòng ${room.roomNumber}`}
                          onClick={() => void handleCopyBookingPart(row, "lockbox", `b-box-${booking.id}`)}
                        />
                      </div>
                    </div>

                    {/* Action Row: Combined Copy + Manager Override Controls */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <CopyButton
                        size="xs"
                        label="Copy cổng + hộp khóa"
                        disabled={!res?.resolved.gate && !res?.resolved.lockbox}
                        copied={copiedKey === `b-both-${booking.id}`}
                        ariaLabel={`Sao chép trọn bộ mã cửa phòng ${room.roomNumber} cho ${booking.guestName}`}
                        onClick={() => void handleCopyBookingPart(row, "both", `b-both-${booking.id}`)}
                      />

                      {isManager && !isEditingThis && (
                        <div className="flex flex-wrap items-center gap-2">
                          {isOverride && (
                            confirmDeleteOverrideId === booking.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={overrideSaving}
                                  onClick={() => void handleDeleteBookingOverride(booking.id)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                                >
                                  Xác nhận gỡ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteOverrideId(null)}
                                  className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteOverrideId(booking.id)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 border border-rose-200 bg-rose-50/70 hover:bg-rose-100 cursor-pointer"
                              >
                                Gỡ mã riêng
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBookingId(booking.id);
                              setOverrideInput(isOverride && reveal && res?.gateCode ? res.gateCode : "");
                              setOverrideNoteInput(res?.overrideNote ?? "");
                              setOverrideError(null);
                              setConfirmDeleteOverrideId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 cursor-pointer"
                          >
                            {isOverride ? "Sửa mã riêng" : "Đặt mã riêng"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Manager-only inline per-booking override editor */}
                    {isManager && isEditingThis && (
                      <div className="mt-3 p-3 rounded-xl bg-white border border-amber-300 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {isOverride ? "Cập nhật mã cổng riêng cho booking" : "Đặt mã cổng riêng cho booking"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOverrideInput(generatePinCandidate())}
                            className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                          >
                            Tạo nhanh 4 số
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label htmlFor={`ov-code-${booking.id}`} className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Mã cổng riêng (3 đến 12 ký tự: 0-9, *, #)
                            </label>
                            <input
                              id={`ov-code-${booking.id}`}
                              type="text"
                              inputMode="tel"
                              value={overrideInput}
                              onChange={(e) => setOverrideInput(e.target.value)}
                              placeholder="VD: 2580#"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-base sm:text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <label htmlFor={`ov-note-${booking.id}`} className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Ghi chú cho lễ tân (tuỳ chọn)
                            </label>
                            <input
                              id={`ov-note-${booking.id}`}
                              type="text"
                              value={overrideNoteInput}
                              onChange={(e) => setOverrideNoteInput(e.target.value)}
                              placeholder="VD: Khách đặt sát giờ / Mã riêng"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                        {overrideError && <p className="text-xs font-semibold text-rose-700">{overrideError}</p>}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingBookingId(null);
                              setOverrideInput("");
                              setOverrideNoteInput("");
                              setOverrideError(null);
                            }}
                          >
                            Hủy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            isLoading={overrideSaving}
                            onClick={() => void handleSaveBookingOverride(booking.id)}
                          >
                            Lưu mã riêng
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────── TAB 2: KHOẢNG NGÀY & HỘP KHÓA ──────────────────── */}
      {activeTab === "vault" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Gate Pass Section */}
          <div className="lg:col-span-7 space-y-4">
            {isManager ? (
              <form
                onSubmit={(e) => void handleCreateGateCode(e)}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Tạo mã cổng dùng chung</h3>
                    <p className="text-xs text-slate-500">
                      Áp dụng cho tất cả booking trong khoảng ngày chọn (trừ booking đã đặt mã riêng).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGateCodeInput(generatePinCandidate())}
                    className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Tạo nhanh 4 số
                  </button>
                </div>

                {/* Scope Mode Toggle */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setGateScopeMode("range")}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      gateScopeMode === "range"
                        ? "bg-white text-emerald-800 border border-slate-200 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Khoảng ngày cụ thể
                  </button>
                  <button
                    type="button"
                    onClick={() => setGateScopeMode("open")}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      gateScopeMode === "open"
                        ? "bg-white text-emerald-800 border border-slate-200 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Từ bây giờ đến khi đổi
                  </button>
                </div>

                {/* PIN & Label */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="gate-code-pin" className="block text-[11px] font-bold text-slate-600 mb-1">
                      Mã cổng (0-9, *, # dài 3 đến 12 ký tự)
                    </label>
                    <input
                      id="gate-code-pin"
                      type="text"
                      inputMode="tel"
                      value={gateCodeInput}
                      onChange={(e) => setGateCodeInput(e.target.value)}
                      placeholder="VD: 2580#"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="gate-code-label" className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nhãn / Ghi chú đợt (tuỳ chọn)
                    </label>
                    <input
                      id="gate-code-label"
                      type="text"
                      value={gateLabelInput}
                      onChange={(e) => setGateLabelInput(e.target.value)}
                      placeholder="VD: Tuần 2 tháng 11 / Nhóm cuối tuần"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {gateScopeMode === "range" && (
                  <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    {/* Quick duration presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1">Chọn nhanh:</span>
                      {[
                        { label: "1 ngày", days: 0 },
                        { label: "3 ngày", days: 2 },
                        { label: "7 ngày", days: 6 },
                        { label: "14 ngày", days: 13 },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setGateToDate(addDaysYmd(gateFromDate, p.days))}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 cursor-pointer"
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setGateToDate(endOfMonthYmd(gateFromDate))}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 cursor-pointer"
                      >
                        Hết tháng
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor="gate-from-date" className="block text-[11px] font-bold text-slate-600 mb-1">
                          Từ ngày
                        </label>
                        <input
                          id="gate-from-date"
                          type="date"
                          value={gateFromDate}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            setGateFromDate(v);
                            if (gateToDate < v) setGateToDate(v);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="gate-to-date" className="block text-[11px] font-bold text-slate-600 mb-1">
                          Đến hết ngày
                        </label>
                        <input
                          id="gate-to-date"
                          type="date"
                          min={gateFromDate}
                          value={gateToDate}
                          onChange={(e) => {
                            if (e.target.value) setGateToDate(e.target.value);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={gateCustomTime}
                        onChange={(e) => setGateCustomTime(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Chỉnh giờ bắt đầu và kết thúc cụ thể</span>
                    </label>

                    {gateCustomTime && (
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label htmlFor="gate-from-time" className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Từ giờ (VN)
                          </label>
                          <input
                            id="gate-from-time"
                            type="time"
                            value={gateFromTime}
                            onChange={(e) => setGateFromTime(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-base sm:text-sm bg-white tabular-nums"
                          />
                        </div>
                        <div>
                          <label htmlFor="gate-to-time" className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Đến giờ (VN)
                          </label>
                          <input
                            id="gate-to-time"
                            type="time"
                            value={gateToTime}
                            onChange={(e) => setGateToTime(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-base sm:text-sm bg-white tabular-nums"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-600 tabular-nums">{rangePreviewText}</p>
                {gateFormError && <p className="text-xs font-semibold text-rose-700">{gateFormError}</p>}

                <div className="flex justify-end">
                  <Button type="submit" isLoading={gateSaving} disabled={!gateCodeInput.trim()}>
                    Lưu mã cổng chung
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                Chế độ xem lễ tân: bạn có thể tra cứu và sao chép chính xác mã cổng theo khoảng ngày và mã hộp khóa từng phòng.
              </div>
            )}

            {/* Gate Codes History / Active List */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">Danh sách mã cổng</h3>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInactiveGates}
                    onChange={(e) => setShowInactiveGates(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Hiện cả mã đã tắt</span>
                </label>
              </div>

              {gates.length === 0 ? (
                <p className="py-3 text-xs text-amber-700">Chưa có mã cổng nào trong hệ thống.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {gates.map((g) => {
                    const badge = STATE_BADGE[g.state];
                    return (
                      <li key={g.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-base font-extrabold text-slate-900 tracking-wider tabular-nums">
                              {g.code}
                            </span>
                            <CopyButton
                              size="xs"
                              copied={copiedKey === `gate-list-${g.id}`}
                              ariaLabel={`Sao chép mã cổng ${g.label ?? g.id}`}
                              onClick={() => void handleCopyVaultCode("gate", g.id, g.code, `gate-list-${g.id}`)}
                            />
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 tabular-nums">
                            {formatVnTime(g.validFrom)} → {g.validUntil ? formatVnTime(g.validUntil) : "không giới hạn"} •{" "}
                            {g.source === "telegram" ? "Telegram" : "Quản trị web"}
                            {g.label ? ` • ${g.label}` : ""}
                          </p>
                        </div>

                        {isManager && g.state !== "inactive" && (
                          <button
                            type="button"
                            onClick={() => void handleDeactivateGateCode(g.id)}
                            className="self-start sm:self-center px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 border border-rose-200 bg-rose-50 hover:bg-rose-100 cursor-pointer shrink-0"
                          >
                            Ngưng dùng
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right Column: Fixed Lockboxes per Room */}
          <div className="lg:col-span-5 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Mã hộp khóa cố định từng phòng</h3>
              <p className="text-xs text-slate-500">Mỗi phòng có một mã hộp khóa chìa riêng.</p>
            </div>

            <ul className="divide-y divide-slate-100">
              {ROOM_CATALOG.map((room) => {
                const box = lockboxByRoomId.get(room.id);
                const isEditing = editingRoomId === room.id;
                return (
                  <li key={room.id} className="py-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800">{room.label}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {box?.updatedAt ? `Cập nhật ${formatVnTime(box.updatedAt)}` : "Chưa cài đặt"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono text-sm font-extrabold tracking-wider tabular-nums ${
                            box?.code ? "text-slate-900" : "text-amber-700 font-sans text-xs"
                          }`}
                        >
                          {box?.code ?? "Chưa có"}
                        </span>
                        <CopyButton
                          size="xs"
                          disabled={!box?.code}
                          copied={copiedKey === `box-${room.id}`}
                          ariaLabel={`Sao chép mã hộp khóa ${room.label}`}
                          onClick={() => void handleCopyVaultCode("lockbox", room.id, box?.code ?? null, `box-${room.id}`)}
                        />
                        {isManager && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                setEditingRoomId(null);
                                setRoomCodeInput("");
                                setRoomCodeError(null);
                              } else {
                                setEditingRoomId(room.id);
                                setRoomCodeInput(reveal && box?.code ? box.code : "");
                                setRoomCodeError(null);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer min-h-[34px]"
                          >
                            {isEditing ? "Đóng" : "Đổi mã"}
                          </button>
                        )}
                      </div>
                    </div>

                    {isManager && isEditing && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <label htmlFor={`box-pin-${room.id}`} className="sr-only">
                            Mã hộp khóa mới cho {room.label}
                          </label>
                          <input
                            id={`box-pin-${room.id}`}
                            type="text"
                            inputMode="tel"
                            value={roomCodeInput}
                            onChange={(e) => setRoomCodeInput(e.target.value)}
                            placeholder="Nhập mã mới (VD: 1234)"
                            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-base sm:text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <Button
                            type="button"
                            size="sm"
                            isLoading={roomSavingId === room.id}
                            onClick={() => void handleSaveLockbox(room.id)}
                          >
                            Lưu
                          </Button>
                        </div>
                        {roomCodeError && <p className="text-xs font-semibold text-rose-700">{roomCodeError}</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ──────────────────── TAB 3: NHẬT KÝ MÃ (AUDIT LOG, MANAGER ONLY) ──────────────────── */}
      {activeTab === "audit" && isManager && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-600">
              Nhật ký ghi nhận mọi thay đổi mã cửa (Quản trị web và Telegram). Để bảo mật, mật khẩu được che dạng{" "}
              <span className="font-mono font-bold text-slate-800">•••0#</span>.
            </p>
            <div className="flex items-center gap-1.5 overflow-x-auto shrink-0">
              {(
                [
                  { id: "all", label: "Tất cả" },
                  { id: "gate", label: "Mã cổng" },
                  { id: "booking_override", label: "Mã riêng booking" },
                  { id: "lockbox", label: "Hộp khóa" },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setAuditFilter(chip.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border cursor-pointer ${
                    auditFilter === chip.id
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {auditError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
              <span>{auditError}</span>
              <Button type="button" size="sm" variant="danger" onClick={() => void loadAuditLogs()}>
                Thử lại
              </Button>
            </div>
          )}

          {auditLoading && auditLogs.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 rounded-2xl border border-slate-200">
              <Spinner size="md" />
              <p className="text-xs text-slate-500">Đang tải nhật ký mã cửa...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-10 text-center rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500">
              Chưa có nhật ký thay đổi mã cửa nào.
            </div>
          ) : (
            <ul className="space-y-2">
              {auditLogs.map((item) => {
                const meta = AUDIT_ACTION_META[item.action] ?? {
                  label: item.action,
                  cls: "bg-slate-100 text-slate-700 border-slate-200",
                };
                const details = item.details ?? {};
                const targetDisplay =
                  item.targetType === "lockbox"
                    ? ROOM_BY_ID.get(item.targetId)?.label ?? item.targetId
                    : item.targetType === "booking_override"
                      ? `Booking ${item.targetId}`
                      : `Mã cổng (${item.targetId.slice(0, 12)})`;
                const noteText =
                  typeof details.note === "string" && details.note
                    ? details.note
                    : typeof details.label === "string" && details.label
                      ? details.label
                      : null;

                return (
                  <li key={item.id} className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <span className="font-bold text-slate-900">{targetDisplay}</span>
                        {item.codeMasked && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono font-bold text-slate-800">
                            {item.codeMasked}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 tabular-nums">{formatVnTime(item.createdAt)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                      <span>
                        Người thực hiện:{" "}
                        <strong className="text-slate-800">{item.actorName || `#${item.actorId ?? "?"}`}</strong> (
                        {item.actorRole === "manager" ? "Quản lý" : item.actorRole || "Hệ thống"})
                      </span>
                      <span>Nguồn: {item.source === "telegram" ? "Telegram" : "Quản trị web"}</span>
                      {noteText && <span>Ghi chú: {noteText}</span>}
                      {typeof details.previousMasked === "string" && details.previousMasked && (
                        <span className="font-mono">Mã trước đó: {details.previousMasked}</span>
                      )}
                      {typeof details.validFrom === "string" && (
                        <span className="tabular-nums">
                          Hiệu lực: {formatVnTime(details.validFrom)} →{" "}
                          {typeof details.validUntil === "string" ? formatVnTime(details.validUntil) : "không giới hạn"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
