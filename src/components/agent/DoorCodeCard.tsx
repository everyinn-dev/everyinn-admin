"use client";

import React, { useCallback, useEffect, useState } from "react";
import { agentApi, AgentApiError, type BookingDoorCodeResult } from "@/lib/agentApi";
import { formatBookingDoorCodeCopyText, normalizeDoorCode, ROOM_BY_ID } from "@/lib/doorCodeUtils";
import { useAdminStaff } from "@/components/layout/AdminShell";
import { useToast } from "@/components/ui/Toast";

async function copyTextToClipboard(text: string): Promise<boolean> {
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

/**
 * Door codes for one booking inside BookingDetailDrawer:
 * resolved from shared agent-db vault (per-booking override -> date-range gate pass; fixed lockbox).
 * - Receptionist: read-only view, override indicator, and 1-click Copy buttons beside each code.
 * - Manager: also can set/update/remove per-booking override PIN + note.
 */
export function DoorCodeCard({
  bookingId,
  roomId,
  checkinAt,
  checkoutAt,
}: {
  bookingId: string;
  roomId: string;
  checkinAt: string;
  checkoutAt: string;
}) {
  const toast = useToast();
  const isManager = useAdminStaff()?.role === "manager";
  const [data, setData] = useState<BookingDoorCodeResult | null>(null);
  const [reveal, setReveal] = useState(true);
  const [override, setOverride] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const qs = `roomId=${encodeURIComponent(roomId)}&checkinAt=${encodeURIComponent(new Date(checkinAt).toISOString())}&checkoutAt=${encodeURIComponent(new Date(checkoutAt).toISOString())}`;

  const load = useCallback(
    async (withCodes: boolean) => {
      try {
        const r = await agentApi<BookingDoorCodeResult>(
          `bookings/${encodeURIComponent(bookingId)}/door-code?${qs}${withCodes ? "&reveal=1" : ""}`,
        );
        setData(r.data);
        setUnavailable(false);
      } catch {
        setUnavailable(true);
      }
    },
    [bookingId, qs],
  );

  useEffect(() => {
    void load(reveal);
  }, [load, reveal]);

  const handleCopy = async (part: "gate" | "lockbox" | "both") => {
    let gateCode = data?.gateCode ?? null;
    let lockboxCode = data?.lockboxCode ?? null;
    if (!reveal) {
      try {
        const r = await agentApi<BookingDoorCodeResult>(
          `bookings/${encodeURIComponent(bookingId)}/door-code?${qs}&reveal=1`,
        );
        gateCode = r.data?.gateCode ?? null;
        lockboxCode = r.data?.lockboxCode ?? null;
      } catch {
        toast.error("Không lấy được mã đầy đủ để sao chép.");
        return;
      }
    }
    const roomNumber = ROOM_BY_ID.get(roomId)?.number ?? roomId;
    const text =
      part === "gate"
        ? gateCode
        : part === "lockbox"
          ? lockboxCode
          : formatBookingDoorCodeCopyText({ roomNumber, gateCode, lockboxCode });
    if (!text) {
      toast.error("Chưa có mã để sao chép.");
      return;
    }
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedKey(part);
      setTimeout(() => setCopiedKey(null), 1800);
      toast.success(part === "both" ? "Đã sao chép trọn bộ mã cửa." : "Đã sao chép mã.");
    } else {
      toast.error("Không sao chép được.");
    }
  };

  const saveOverride = async () => {
    if (!isManager) return;
    const normalized = normalizeDoorCode(override);
    if (!normalized) {
      toast.error("Mã chỉ gồm số 0-9, * hoặc #, độ dài 3 đến 12 ký tự.");
      return;
    }
    setSaving(true);
    try {
      await agentApi(`bookings/${encodeURIComponent(bookingId)}/door-code`, {
        method: "PUT",
        body: {
          gateCode: normalized,
          note: overrideNote.trim() || "Mã cổng riêng theo đơn",
        },
      });
      toast.success("Đã lưu mã cổng riêng cho booking này.");
      setOverride("");
      setOverrideNote("");
      await load(reveal);
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Không lưu được mã.");
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async () => {
    if (!isManager) return;
    setSaving(true);
    try {
      await agentApi(`bookings/${encodeURIComponent(bookingId)}/door-code`, { method: "DELETE" });
      toast.success("Đã gỡ mã riêng. Booking quay lại dùng mã cổng chung.");
      await load(reveal);
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Không gỡ được mã riêng.");
    } finally {
      setSaving(false);
    }
  };

  if (unavailable) return null;

  const missing = data?.resolved.missing ?? [];
  const isOverride = data?.resolved.gate?.source === "override";

  return (
    <div className={`p-3.5 rounded-xl border shadow-xs space-y-2.5 ${isOverride ? "bg-amber-50/40 border-amber-300" : "bg-slate-50 border-slate-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mã cửa</span>
          {isOverride && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
              Mã riêng booking
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
        >
          {reveal ? "Ẩn mã" : "Hiện mã"}
        </button>
      </div>

      {isOverride && (
        <div className="px-2.5 py-1.5 rounded-lg bg-amber-100/80 border border-amber-300 text-[11px] text-amber-950">
          <strong>Lưu ý mã riêng:</strong> {data?.overrideNote || "Booking này dùng mã cổng riêng thay cho mã chung."}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-slate-500 text-[11px]">
                {isOverride ? "Pass cổng (Mã riêng)" : "Pass cổng (Dùng chung)"}
              </p>
              <p className={`font-mono text-sm font-extrabold tabular-nums mt-0.5 ${data.resolved.gate ? "text-slate-900" : "text-rose-700 text-xs font-sans"}`}>
                {data.resolved.gate ? (reveal ? data.gateCode : "••••") : "Chưa có"}
              </p>
            </div>
            <button
              type="button"
              disabled={!data.resolved.gate}
              onClick={() => void handleCopy("gate")}
              aria-label="Sao chép mã cổng"
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
                copiedKey === "gate"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300"
              }`}
            >
              {copiedKey === "gate" ? "Đã copy" : "Copy"}
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-slate-500 text-[11px]">Hộp khóa phòng</p>
              <p className={`font-mono text-sm font-extrabold tabular-nums mt-0.5 ${data.resolved.lockbox ? "text-slate-900" : "text-amber-700 text-xs font-sans"}`}>
                {data.resolved.lockbox ? (reveal ? data.lockboxCode : "••••") : "Chưa có"}
              </p>
            </div>
            <button
              type="button"
              disabled={!data.resolved.lockbox}
              onClick={() => void handleCopy("lockbox")}
              aria-label="Sao chép mã hộp khóa"
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
                copiedKey === "lockbox"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300"
              }`}
            >
              {copiedKey === "lockbox" ? "Đã copy" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {data && (data.resolved.gate || data.resolved.lockbox) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void handleCopy("both")}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              copiedKey === "both"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-700 border-slate-300 hover:bg-emerald-50 hover:text-emerald-800"
            }`}
          >
            {copiedKey === "both" ? "Đã sao chép cả hai" : "Copy cổng + hộp khóa"}
          </button>

          {isManager && isOverride && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void removeOverride()}
              className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer disabled:opacity-50"
            >
              Gỡ mã riêng
            </button>
          )}
        </div>
      )}

      {missing.length > 0 && (
        <p className="text-[11px] text-amber-800">
          Thiếu {missing.map((m) => (m === "gate" ? "mã cổng" : "mã hộp khóa")).join(" + ")}.{" "}
          {isManager
            ? "Quản lý có thể nhập mã cổng bên dưới hoặc dùng nút Mã cửa trên Bảng Phòng."
            : "Vui lòng báo quản lý bổ sung mã cửa trước giờ khách nhận phòng."}
        </p>
      )}

      {isManager && (
        <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
          <div className="flex gap-1.5">
            <input
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder="Đặt mã cổng riêng cho đơn (VD: 2580#)"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-base sm:text-sm font-mono bg-white"
              inputMode="tel"
            />
            <button
              type="button"
              disabled={!override.trim() || saving}
              onClick={() => void saveOverride()}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white disabled:opacity-50 cursor-pointer"
            >
              Lưu
            </button>
          </div>
          {override.trim() && (
            <input
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="Ghi chú cho lễ tân (tuỳ chọn, VD: Mã riêng booking)"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
            />
          )}
        </div>
      )}
    </div>
  );
}
