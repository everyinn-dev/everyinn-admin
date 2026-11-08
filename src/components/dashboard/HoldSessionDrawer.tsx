"use client";
/**
 * LSB-5 — tapped a live hold on the Gantt. A web (or admin) hold is driven by its booking session in agent-core,
 * so every button here is the SAME command as the Telegram card (✅ đã nhận / ❌ chưa nhận / 🗑 thu hồi): the
 * guest's page, the Telegram card and this drawer stay in sync. Updates live through the session long-poll.
 */
import React, { useEffect, useState } from "react";
import type { GanttHoldItem, GanttRoomData } from "@/types";
import { useToast } from "../ui/Toast";
import { useLongPoll } from "@/shared/booking-kit/live";
import { timeOf, vnd } from "@/shared/booking-kit/format";
import { holdCountdown, holdLabel } from "./GanttHoldBar";
import { notifyDataChanged } from "@/lib/syncEvents";
import { eventLabel } from "../bookings/checkout/sessionLabels";

type Detail = {
  session: { id: string; ref: string; status: string; statusLabel: string; amountDue: number; paidAmount: number; remaining: number; bookingId: string | null; version: number };
  events: { id: number; event: string; accepted: boolean; actor: { name: string | null }; source: string; at: string }[];
};
type Live = Detail & { version: number };

const CAN_CONFIRM = new Set(["awaiting_payment", "payment_claimed", "underpaid"]);
const CAN_REVOKE = new Set(["holding", "awaiting_payment", "payment_claimed", "underpaid"]);

export const HoldSessionDrawer: React.FC<{ hold: GanttHoldItem; room: GanttRoomData; onClose: () => void; onChanged: () => void }> = ({ hold, room, onClose, onChanged }) => {
  const toast = useToast();
  const [initial, setInitial] = useState<Live | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const sid = hold.sessionId;

  useEffect(() => {
    if (!sid) return;
    let ignore = false;
    fetch(`/api/sessions/${sid}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Detail>) : null))
      .then((d) => {
        if (d && !ignore) setInitial({ ...d, version: d.session.version });
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [sid]);

  const live = useLongPoll<Live>({
    url: (v) => (sid && initial ? `/api/sessions/${sid}/live?v=${v}` : null),
    initial: null,
    pick: (b) => {
      const d = b as Detail;
      return d?.session ? { ...d, version: d.session.version } : null;
    },
    enabled: !!sid && !!initial,
  });
  const d = live.data && (!initial || live.data.version >= initial.version) ? live.data : initial;
  const s = d?.session;

  const act = async (action: string, body: Record<string, unknown> = {}, okMsg?: string) => {
    if (!sid) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/sessions/${sid}/${action}`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `${action}-${sid}-${crypto.randomUUID()}` }, body: JSON.stringify(body) });
      const data = (await res.json()) as Detail & { url?: string; error?: string };
      if (!res.ok) return toast.error(data.error ?? "Thao tác chưa thành công.");
      if (data.session) live.setData({ ...data, version: data.session.version });
      if (action === "share-link" && data.url) {
        try {
          await navigator.clipboard.writeText(data.url);
          toast.success("Đã copy link thanh toán — gửi cho khách.");
        } catch {
          toast.info(data.url);
        }
        return;
      }
      if (okMsg) toast.success(okMsg);
      notifyDataChanged("BOOKINGS_CHANGED");
      onChanged();
    } finally {
      setBusy(null);
      setConfirmRevoke(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Phòng đang được giữ">
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-xl overflow-y-auto">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{holdLabel(hold)}</p>
            <h2 className="text-lg font-black text-slate-900">
              {room.name} · {timeOf(hold.checkinAt)} → {timeOf(hold.checkoutAt)}
            </h2>
            <p className="text-sm text-slate-600">
              {hold.guestNameMasked ?? "Khách chưa nhập thông tin"} · còn <span className="font-mono tabular-nums">{holdCountdown(hold.expiresAt)}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-500" aria-label="Đóng">
            ✕
          </button>
        </div>

        {!sid ? (
          <p className="p-5 text-sm text-slate-600">Giữ phòng này không qua phiên đặt phòng (tạo trước khi có tính năng). Đợi hết hạn hoặc thao tác ở màn đặt phòng.</p>
        ) : !s ? (
          <p className="p-5 text-sm text-slate-500">Đang tải phiên…</p>
        ) : (
          <div className="p-5 space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-sm font-bold text-slate-900">{s.statusLabel}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {s.ref} · cần thu {vnd(s.amountDue)}
                {s.paidAmount ? ` · đã nhận ${vnd(s.paidAmount)}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CAN_CONFIRM.has(s.status) && (
                <button type="button" disabled={!!busy} onClick={() => act("confirm", { method: "bank_transfer" }, "Đã xác nhận — đơn đã lên lịch.")} className="h-11 rounded-xl bg-emerald-600 text-white text-sm font-black disabled:opacity-50">
                  ✅ Đã nhận {vnd(s.remaining)}
                </button>
              )}
              {s.status === "payment_claimed" && (
                <button type="button" disabled={!!busy} onClick={() => act("reject", {}, "Đã báo khách: chưa nhận được tiền.")} className="h-11 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-800">
                  ❌ Chưa nhận
                </button>
              )}
              {s.status === "underpaid" && (
                <button type="button" disabled={!!busy} onClick={() => act("accept-short", {}, "Đã chốt dạng cọc.")} className="h-11 rounded-xl bg-white border border-amber-300 text-sm font-bold text-amber-800">
                  Chốt dạng cọc
                </button>
              )}
              {CAN_REVOKE.has(s.status) && s.status !== "confirmed" && (
                <button type="button" disabled={!!busy} onClick={() => act("share-link")} className="h-11 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-800">
                  🔗 Link thanh toán
                </button>
              )}
            </div>

            {CAN_REVOKE.has(s.status) &&
              (confirmRevoke ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                  <p className="text-sm text-rose-800">Thu hồi phòng? Khách đang giữ sẽ thấy “Đơn đã được huỷ” và phòng mở bán lại ngay.</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={!!busy} onClick={() => act("revoke", { reason: "Lễ tân thu hồi từ bảng phòng" }, "Đã thu hồi phòng.")} className="flex-1 h-10 rounded-xl bg-rose-600 text-white text-sm font-bold">
                      Thu hồi
                    </button>
                    <button type="button" onClick={() => setConfirmRevoke(false)} className="flex-1 h-10 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-700">
                      Giữ lại
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmRevoke(true)} className="w-full h-10 rounded-xl bg-rose-500/10 text-rose-700 text-sm font-bold">
                  🗑 Thu hồi phòng
                </button>
              ))}

            {d?.events?.length ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Dòng thời gian</p>
                <ol className="space-y-1.5 text-sm">
                  {d.events.map((e) => (
                    <li key={e.id} className={`flex items-baseline gap-2 ${e.accepted ? "text-slate-700" : "text-slate-400 line-through"}`}>
                      <span className="font-mono text-xs text-slate-400 tabular-nums">{timeOf(e.at)}</span>
                      <span className="truncate">{eventLabel(e.event)}</span>
                      <span className="ml-auto text-xs text-slate-500 shrink-0">
                        {e.actor.name ?? "—"} · {e.source}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
