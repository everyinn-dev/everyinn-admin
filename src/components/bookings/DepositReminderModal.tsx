"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "../ui/Toast";
import { apiFetch } from "@/lib/apiClient";
import { notifyDataChanged } from "@/lib/syncEvents";

interface DepositReminderItem {
  id: string;
  room_id: string;
  room_name?: string;
  room_class?: string;
  member_name: string;
  member_phone: string;
  instagram?: string;
  facebook?: string;
  booking_type: string;
  checkin_at: string;
  checkout_at: string;
  total_price: number;
  deposit_amount: number;
  paid_amount: number;
  remaining_amount: number;
  deposit_due_date: string;
  deposit_status: string;
  deposit_reminder_sent_at?: string;
  closing_note?: string;
  note?: string;
}

export const DepositReminderModal: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const [reminders, setReminders] = useState<DepositReminderItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [markingIds, setMarkingIds] = useState<Record<string, boolean>>({});

  // Today in Vietnam (UTC+7)
  const todayStr = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

  const checkReminders = useCallback(async () => {
    // Don't pop up on login page
    if (pathname === "/login") return;

    // Check snooze in localStorage
    const snoozedUntilStr = localStorage.getItem("deposit_reminder_snoozed_until");
    if (snoozedUntilStr) {
      const snoozedUntil = parseInt(snoozedUntilStr, 10);
      if (!isNaN(snoozedUntil) && Date.now() < snoozedUntil) {
        return; // Still in snooze period
      }
    }

    try {
      const res = await apiFetch("/api/bookings/deposit-reminders");
      if (res.status === 304) return;
      if (!res.ok) return;

      const data = (await res.json()) as any;
      if (data && Array.isArray(data.reminders) && data.reminders.length > 0) {
        setReminders(data.reminders);
        setIsOpen(true);
      } else {
        setReminders([]);
        setIsOpen(false);
      }
    } catch {
      // Silently ignore network hiccup during background polling
    }
  }, [pathname]);

  // 1. Initial check & interval polling
  useEffect(() => {
    checkReminders();

    // 60-second background polling
    const interval = setInterval(checkReminders, 60000);

    // Cross-tab broadcast listener
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("everyinn_sync_channel");
      channel.onmessage = (event) => {
        if (
          event.data?.type === "BOOKINGS_CHANGED" ||
          event.data?.type === "DEPOSIT_REMINDER_CHECK"
        ) {
          checkReminders();
        }
      };
    } catch {
      // BroadcastChannel unsupported
    }

    // Window focus / visibilitychange revalidation
    const handleFocus = () => checkReminders();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(interval);
      if (channel) channel.close();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [checkReminders]);

  // Handle Mark Reminder Sent for single booking
  const handleMarkSent = async (bookingId: string) => {
    try {
      setMarkingIds((prev) => ({ ...prev, [bookingId]: true }));
      const res = await apiFetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_deposit_reminder_sent" }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Không thể ghi nhận gửi nhắc cọc.");
      }

      toast.success(
        `Đã ghi nhận gửi nhắc cọc cho đơn #${bookingId}.`,
        "Đã gửi nhắc cọc"
      );

      // Remove from active modal list
      const remaining = reminders.filter((r) => r.id !== bookingId);
      setReminders(remaining);
      if (remaining.length === 0) {
        setIsOpen(false);
      }

      notifyDataChanged("BOOKINGS_CHANGED");
    } catch (err: any) {
      toast.error(err.message || "Lỗi ghi nhận nhắc cọc.", "Lỗi");
    } finally {
      setMarkingIds((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  // Snooze handlers
  const handleSnooze = (minutes: number) => {
    const snoozedUntil = Date.now() + minutes * 60 * 1000;
    localStorage.setItem("deposit_reminder_snoozed_until", snoozedUntil.toString());
    setIsOpen(false);
    toast.info(
      `Hệ thống sẽ nhắc lại sau ${minutes} phút.`,
      "Đã tạm hoãn nhắc nhở"
    );
  };

  if (!isOpen || reminders.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner animate-bounce">
              🔔
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Cần Thu Cọc Phần Còn Lại Hôm Nay
              </h3>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                Có <span className="font-bold underline">{reminders.length} đơn</span> đến hạn nhận đủ tiền cọc
              </p>
            </div>
          </div>
          <button
            onClick={() => handleSnooze(15)}
            title="Đóng & Nhắc lại sau 15 phút"
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Bookings List */}
        <div className="p-5 space-y-3.5 overflow-y-auto flex-1 bg-slate-50/70">
          {reminders.map((item) => {
            const checkin = new Date(item.checkin_at);
            const isOverdue = item.deposit_due_date < todayStr;
            const remaining =
              item.remaining_amount ?? (item.total_price - (item.paid_amount || item.deposit_amount || 0));

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3 transition-all hover:border-amber-300"
              >
                {/* Top Row: Room & Guest Info */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        #{item.id}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Phòng {item.room_id} {item.room_name ? `(${item.room_name})` : ""}
                      </span>
                      {isOverdue ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                          ⚠️ Quá hạn
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          📅 Hôm nay đến hạn
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-bold text-slate-900 mt-1">{item.member_name}</p>
                    <p className="text-xs font-mono text-emerald-700 font-semibold">{item.member_phone}</p>
                  </div>

                  <a
                    href={`tel:${item.member_phone}`}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1 shadow-xs transition-colors shrink-0"
                  >
                    <span>📞</span> Gọi
                  </a>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-medium">Đã cọc:</span>
                    <span className="font-mono font-bold text-slate-700">
                      {(item.paid_amount || item.deposit_amount || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-amber-900 block font-bold">Cần thu nốt:</span>
                    <span className="font-mono font-extrabold text-amber-900 text-sm">
                      {remaining.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                </div>

                {/* Checkin Schedule & Agreement Note */}
                <div className="text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Giờ nhận phòng (Check-in):</span>
                    <span className="font-semibold text-slate-800">
                      {checkin.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{" "}
                      {checkin.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                  {item.closing_note && (
                    <p className="text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-200 line-clamp-2">
                      &ldquo;{item.closing_note}&rdquo;
                    </p>
                  )}
                </div>

                {/* Actions per Booking */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={markingIds[item.id]}
                    onClick={() => handleMarkSent(item.id)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <span>💬</span>
                    <span>{markingIds[item.id] ? "Đang lưu..." : "Đã gửi nhắc cọc"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/bookings?search=${encodeURIComponent(item.id)}&autoOpen=true`);
                    }}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>💰</span>
                    <span>Xem & Thu Tiền</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Tạm hoãn:</span>
            <button
              type="button"
              onClick={() => handleSnooze(15)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              15 phút
            </button>
            <button
              type="button"
              onClick={() => handleSnooze(60)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              1 giờ
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSnooze(15)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Đóng Nhắc Nhở
          </button>
        </div>
      </div>
    </div>
  );
};
