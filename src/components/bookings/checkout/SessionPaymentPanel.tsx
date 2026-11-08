"use client";
/**
 * LSB-5 — step 3 of the receptionist wizard, on the SAME booking-session engine as the guest landing page:
 *  - VietQR (same payment intent / EIPAY reference as the web), or "Gửi link thanh toán" → the guest pays on
 *    their phone at /dat-phong/<token> and this panel flips by itself (long-poll on the session DO);
 *  - money received at the desk: method (CK / tiền mặt / thẻ / ví) + amount → short = underpaid (chốt cọc /
 *    yêu cầu bù), over = recorded as received; every step lands in the session's audit timeline.
 * Replaces the former mock payment step.
 */
import React, { useEffect, useRef, useState } from "react";
import type { CoreHoldDto } from "@/lib/coreMappers";
import type { Room } from "@/types";
import { useToast } from "../../ui/Toast";
import { useLongPoll } from "@/shared/booking-kit/live";
import { timeOf, vnd } from "@/shared/booking-kit/format";
import { eventLabel } from "./sessionLabels";

type Detail = {
  session: {
    id: string;
    status: string;
    statusLabel: string;
    amountDue: number;
    paidAmount: number;
    remaining: number;
    bookingId: string | null;
    payment: { amount: number; reference: string; qrUrl: string | null; account: string | null; holderName: string | null } | null;
    pricing: { subtotal: number; promotion: { name: string; discount: number } | null; voucher: { codeMasked: string; discount: number } | null; total: number } | null;
    version: number;
  };
  events: { id: number; event: string; accepted: boolean; actor: { name: string | null }; source: string; at: string }[];
  payments: { id: string; amount: number; method: string; staffName: string | null; at: string }[];
};
type Live = Detail & { version: number };

const METHODS = [
  { id: "bank_transfer", label: "Chuyển khoản" },
  { id: "cash", label: "Tiền mặt" },
  { id: "card", label: "Thẻ" },
  { id: "ewallet", label: "Ví điện tử" },
] as const;


interface Props {
  hold: CoreHoldDto;
  room: Room;
  sessionId: string | null;
  releasing: boolean;
  onBackToEditInfo: () => void;
  onExitAndReselect: () => void;
  onPaymentConfirmed: (result: { booking: any; telegramSent: boolean; telegramReason: string | null }) => void;
}

export const SessionPaymentPanel: React.FC<Props> = ({ hold, room, sessionId: initialSid, releasing, onBackToEditInfo, onExitAndReselect, onPaymentConfirmed }) => {
  const toast = useToast();
  const [sid, setSid] = useState<string | null>(initialSid);
  const [initial, setInitial] = useState<Live | null>(null);
  const [method, setMethod] = useState<string>("bank_transfer");
  const [amount, setAmount] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      let id = sid;
      if (!id) {
        const r = await fetch(`/api/sessions/by-hold/${encodeURIComponent(hold.id)}`);
        if (!r.ok) return;
        id = ((await r.json()) as { sessionId: string }).sessionId;
        if (!ignore) setSid(id);
      }
      const r = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
      if (r.ok && !ignore) {
        const d = (await r.json()) as Detail;
        setInitial({ ...d, version: d.session.version });
      }
    })();
    return () => {
      ignore = true;
    };
  }, [hold.id, sid]);

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

  // finished on any path (desk payment, guest paid via the link + ✅ on Telegram) → completed screen
  const finalize = async () => {
    if (finished.current) return;
    finished.current = true;
    const res = await fetch(`/api/holds/${encodeURIComponent(hold.id)}/confirm-payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentMethod: method }) });
    const data = (await res.json()) as { booking?: unknown; telegramSent?: boolean; telegramReason?: string | null; error?: string };
    if (res.ok && data.booking) onPaymentConfirmed({ booking: data.booking, telegramSent: Boolean(data.telegramSent), telegramReason: data.telegramReason ?? null });
    else finished.current = false;
  };
  useEffect(() => {
    if (s?.status === "confirmed") void finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.status]);

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    if (!sid) return null;
    setBusy(action);
    try {
      const res = await fetch(`/api/sessions/${sid}/${action}`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `${action}-${sid}-${crypto.randomUUID()}` }, body: JSON.stringify(body) });
      const data = (await res.json()) as Detail & { url?: string; error?: string; details?: { message?: string } };
      if (!res.ok) {
        toast.error(data.error ?? "Thao tác chưa thành công.");
        return null;
      }
      if (data.session) live.setData({ ...data, version: data.session.version });
      return data;
    } finally {
      setBusy(null);
    }
  };

  const receive = async () => {
    const remaining = s?.remaining ?? hold.payableAmount;
    const n = amount.trim() ? Math.round(Number(amount.replace(/[^\d]/g, ""))) : remaining;
    if (!n) return toast.error("Nhập số tiền đã nhận.");
    const out = await act("payments", { amount: n, method });
    if (out?.session.status === "underpaid") toast.warning(`Đã ghi nhận ${vnd(n)} — còn thiếu ${vnd(out.session.remaining)}.`);
    setAmount("");
  };

  const share = async () => {
    const out = (await act("share-link")) as { url?: string } | null;
    if (out?.url) {
      setLink(out.url);
      try {
        await navigator.clipboard.writeText(out.url);
        toast.success("Đã copy link — gửi cho khách qua Zalo / Messenger.");
      } catch {
        toast.info("Link đã tạo, bấm giữ để copy.");
      }
    }
  };

  const p = s?.payment;
  const due = s ? s.remaining : hold.payableAmount;
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Thanh toán · {room.name}</p>
            <h2 className="text-xl font-black text-slate-900">{s ? s.statusLabel : "Đang tải phiên…"}</h2>
            {s?.paidAmount ? <p className="text-sm text-slate-600">Đã nhận {vnd(s.paidAmount)} / {vnd(s.amountDue)}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Còn phải thu</p>
            <p className="text-2xl font-black text-emerald-700 tabular-nums">{vnd(due)}</p>
          </div>
        </div>

        {s?.status === "underpaid" ? (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex flex-wrap items-center gap-2 justify-between">
            <span>Khách chuyển thiếu {vnd(s.remaining)}.</span>
            <span className="flex gap-2">
              <button className="h-10 px-3 rounded-xl bg-white border border-amber-300 font-bold text-xs" disabled={!!busy} onClick={() => act("accept-short")}>
                Chốt dạng cọc {vnd(s.paidAmount)}
              </button>
              <button className="h-10 px-3 rounded-xl bg-white border border-amber-300 font-bold text-xs" disabled={!!busy} onClick={() => act("request-topup")}>
                Yêu cầu khách chuyển bù
              </button>
            </span>
          </div>
        ) : null}
        {s?.status === "payment_claimed" ? <div className="mx-5 mt-4 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-sm">Khách báo đã chuyển khoản — kiểm tra tài khoản rồi bấm “Đã nhận”.</div> : null}

        <div className="p-5 grid sm:grid-cols-2 gap-5">
          <div className="flex flex-col items-center gap-2">
            {p?.qrUrl ? <img src={p.qrUrl} alt="VietQR" className="w-56 h-56 object-contain rounded-xl border border-slate-200 bg-white p-2" /> : <div className="w-56 h-56 rounded-xl bg-slate-100" />}
            <p className="text-xs text-slate-500 text-center">
              {p ? (
                <>
                  {p.account} · {p.holderName}
                  <br />
                  Nội dung <span className="font-mono font-bold text-slate-800">{p.reference}</span>
                </>
              ) : null}
            </p>
            <button type="button" onClick={share} disabled={!!busy || !sid} className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50">
              🔗 Gửi link thanh toán cho khách
            </button>
            {link ? <p className="text-[11px] text-slate-500 break-all text-center">{link}</p> : null}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Hình thức nhận</p>
              <div className="grid grid-cols-2 gap-1.5">
                {METHODS.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`h-10 rounded-xl text-sm font-bold border ${method === m.id ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-slate-200 text-slate-600"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Số tiền đã nhận</span>
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${due.toLocaleString("vi-VN")} (mặc định đủ)`} className="mt-1.5 w-full h-11 md:h-10 rounded-xl border border-slate-300 px-3 text-sm bg-white" />
            </label>
            <button type="button" onClick={receive} disabled={!!busy || !s || s.status === "confirmed"} className="w-full h-11 md:h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black disabled:opacity-50">
              {busy === "payments" ? "Đang ghi nhận…" : amount.trim() ? "✅ Ghi nhận số tiền này" : `✅ Đã nhận đủ ${vnd(due)}`}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onBackToEditInfo} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white">
                Sửa thông tin
              </button>
              <button type="button" onClick={onExitAndReselect} disabled={releasing} className="flex-1 h-10 rounded-xl bg-rose-500/10 text-rose-700 text-sm font-bold">
                {releasing ? "Đang huỷ…" : "Thu hồi phòng"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {d?.events?.length ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Dòng thời gian (audit)</p>
          <ol className="space-y-1.5 text-sm">
            {d.events.map((e) => (
              <li key={e.id} className={`flex items-baseline gap-2 ${e.accepted ? "text-slate-700" : "text-slate-400 line-through"}`}>
                <span className="font-mono text-xs text-slate-400 tabular-nums">{timeOf(e.at)}</span>
                <span>{eventLabel(e.event)}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {e.actor.name ?? "—"} · {e.source}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
};
