"use client";

/** Bảng quyền: capability × guest segment matrix (AI-7 W4). Cell = who decides; dashed = proposal switched off. */
import React, { useEffect, useState } from "react";
import { DECIDER_LABEL, DECIDER_SHORT, type Decider, type MdData, type MdRow } from "@/lib/agentOps";
import { EmptyLine, Icon, ScreenHead, Switch, btn, cls } from "./ui";
import { MdForm } from "./MdForm";
import { SplitLayout, type OpsCtx } from "./AgentOps";

const SEG_SHORT: Record<string, string> = { any: "Mọi khách", watch: "Lưu ý", vip: "VIP", regular: "Quen", returning: "Cũ", new: "Mới" };
const CAP_SHORT: Record<string, string> = { extend_stay: "Thêm giờ", deposit_exception: "Cọc sát ngày", discount: "Giảm giá", early_checkin: "Nhận sớm", late_checkout_free: "Trả muộn", refund_cancel: "Hoàn tiền" };

type A = { capability?: string; segment?: string; decider?: Decider; maxHours?: number; maxPercent?: number; maxAmount?: number; validUntil?: string; days?: string[]; from?: string; to?: string; note?: string };
const a = (r: MdRow) => r.data as A;
/** A row with a time window or expiry is a temporary delegation, listed under the matrix. */
const isTemporary = (r: MdRow) => !!(a(r).validUntil || a(r).from || a(r).to || (a(r).days?.length ?? 0) > 0);
const limitText = (d: A) => (d.maxHours ? `≤${d.maxHours}h` : d.maxPercent ? `≤${d.maxPercent}%` : d.maxAmount ? `≤${Math.round(d.maxAmount / 1000)}k` : "");

export function AuthorityScreen({ ctx }: { ctx: OpsCtx }) {
  const def = ctx.registry.collections.find((c) => c.id === "authority")!;
  const rows = ctx.rows.authority;
  const caps = ctx.registry.capabilities;
  const segs = [{ id: "any", label: "Mọi khách", emoji: "" }, ...ctx.rows.segments.filter((s) => s.isActive).map((s) => ({ id: s.id, label: String(s.data.label ?? s.id), emoji: String(s.data.emoji ?? "") }))];
  const base = rows.filter((r) => !isTemporary(r));
  const temporary = rows.filter(isTemporary);
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<MdData | null>(null);
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const upd = () => setNarrow(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);
  useEffect(() => {
    if (sel === null && !draft && window.matchMedia("(min-width: 1024px)").matches) {
      const first = base.find((r) => !r.isActive) ?? base[0];
      if (first) setSel(first.id);
    }
  }, [base, sel, draft]);

  const cellRow = (cap: string, seg: string) => {
    const m = base.filter((r) => a(r).capability === cap && a(r).segment === seg);
    return m.find((r) => r.isActive) ?? m[0] ?? null;
  };
  const pending = base.filter((r) => !r.isActive).length;
  const row = draft ? null : rows.find((r) => r.id === sel) ?? null;
  const pickRow = (id: string) => {
    setDraft(null);
    setSel(id);
    setOpen(true);
  };
  const pickEmpty = (cap: string, seg: string) => {
    if (!ctx.canEdit) return;
    setSel(null);
    setDraft({ capability: cap, segment: seg, decider: "manager" });
    setOpen(true);
  };

  const cell = (cap: string, seg: string) => {
    const r = cellRow(cap, seg);
    if (!r)
      return (
        <button
          type="button"
          onClick={() => pickEmpty(cap, seg)}
          disabled={!ctx.canEdit}
          title={seg === "any" ? "Chưa có quyền" : "Theo cột Mọi khách — bấm để đặt riêng"}
          className={`flex h-11 w-full items-center whitespace-nowrap rounded-lg px-2 text-xs text-slate-500 ${ctx.canEdit ? "hover:bg-slate-100" : ""} ${draft?.capability === cap && draft?.segment === seg ? "outline outline-2 outline-offset-1 outline-emerald-700" : ""}`}
        >
          —
        </button>
      );
    const d = a(r);
    const tone = !r.isActive
      ? "border-dashed border-slate-300 bg-white text-slate-600"
      : d.decider === "ai" || d.decider === "ai_after_timeout"
        ? "border-transparent bg-emerald-50 text-emerald-800"
        : d.decider === "never"
          ? "border-transparent bg-slate-100 text-slate-600"
          : "border-slate-300 bg-white text-slate-800";
    const lim = limitText(d);
    return (
      <button
        type="button"
        onClick={() => pickRow(r.id)}
        aria-pressed={!draft && sel === r.id}
        title={`${DECIDER_LABEL[d.decider ?? "manager"]}${lim ? ` ${lim}` : ""}${r.isActive ? "" : " · đề xuất, đang tắt"}`}
        className={`flex h-11 w-full items-center rounded-lg border px-2 text-left text-xs ${tone} ${!draft && sel === r.id ? "outline outline-2 outline-offset-1 outline-emerald-700" : ""}`}
      >
        <span className="flex items-center gap-1 whitespace-nowrap">
          {!r.isActive ? <span className="size-1.5 shrink-0 rounded-full bg-amber-600" aria-label="Đề xuất" /> : null}
          <span className="font-semibold">{DECIDER_SHORT[d.decider ?? "manager"]}</span>
          {lim ? <span>{lim}</span> : null}
        </span>
      </button>
    );
  };

  const form = row || draft ? (
    <MdForm
      key={draft ? `new-${draft.capability}-${draft.segment}` : row!.id}
      def={def}
      row={row}
      draft={draft ?? undefined}
      ctx={ctx.opt}
      canEdit={ctx.canEdit}
      myStaffId={ctx.myStaffId}
      title={`${CAP_SHORT[String((row?.data ?? draft)!.capability)] ?? (row?.data ?? draft)!.capability} · ${segName(String((row?.data ?? draft)!.segment), segs)}`}
      sub={draft ? "Quyền mới cho nhóm khách này" : row!.isActive ? "Đang bật" : "Đề xuất, đang tắt"}
      renderTop={() =>
        row ? (
          <>
            <p className="-mt-2 text-sm text-slate-600 text-pretty">{caps.find((c) => c.id === a(row).capability)?.label}</p>
            {!row.isActive ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2.5">
                <span className="text-sm text-amber-900 text-pretty">{a(row).note || "Đề xuất — chưa áp dụng."}</span>
                {ctx.canEdit ? (
                  <button type="button" className={btn("primary", "sm")} onClick={() => ctx.toggleRow("authority", row, true)}>
                    Bật
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                <span className="text-sm text-slate-700">Đang áp dụng</span>
                <Switch checked onChange={() => ctx.toggleRow("authority", row, false)} label="Tắt quyền này" disabled={!ctx.canEdit} />
              </div>
            )}
          </>
        ) : null
      }
      renderBottom={() => <p className="text-xs text-slate-500 text-pretty">Dòng của nhóm khách cụ thể thắng dòng “Mọi khách”; “Không bao giờ” luôn thắng.</p>}
      onClose={() => {
        setOpen(false);
        setDraft(null);
      }}
      onSaved={(saved) => {
        ctx.putRow("authority", saved);
        setDraft(null);
        setSel(saved.id);
      }}
      onDeleted={(id) => {
        ctx.dropRow("authority", id);
        setSel(null);
        setOpen(false);
      }}
    />
  ) : null;

  return (
    <SplitLayout
      open={open}
      onClose={() => {
        setOpen(false);
        setDraft(null);
      }}
      panel={form}
      list={
        <>
          <ScreenHead title="Bảng quyền" desc="Ai được quyết từng ngoại lệ, theo nhóm khách. Ô viền nét đứt là đề xuất đang tắt — bấm ô để xem và bật." />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-emerald-50" />Home tự chốt</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded border border-slate-300 bg-white" />Hỏi quản lí</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-slate-200" />Không bao giờ</span>
            <span className="inline-flex items-center gap-1.5"><span className="font-semibold text-slate-500">—</span>Như Mọi khách</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded border border-dashed border-slate-300" /><span className="size-1.5 rounded-full bg-amber-600" />Đề xuất ({pending})</span>
          </div>
          {base.length === 0 && !ctx.canEdit ? (
            <EmptyLine>Chưa có quyền nào: mọi ngoại lệ Home đều hỏi quản lí.</EmptyLine>
          ) : narrow ? (
            <div className="grid gap-3">
              {caps.map((c) => (
                <div key={c.id} className={`${cls.card} overflow-hidden`}>
                  <p className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">{CAP_SHORT[c.id] ?? c.label}</p>
                  <div className="divide-y divide-slate-100">
                    {segs.filter((s) => cellRow(c.id, s.id) || s.id === "any").map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                        <span className="w-28 shrink-0 text-sm text-slate-700">{segName(s.id, segs)}</span>
                        <div className="flex-1">{cell(c.id, s.id)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${cls.card} overflow-x-auto`}>
              <table className="w-full min-w-[580px] border-separate border-spacing-1 p-1.5 text-left">
                <thead>
                  <tr>
                    <th className="w-[132px] whitespace-nowrap px-2 pb-1 text-xs font-semibold text-slate-600">Việc cần quyết</th>
                    {segs.map((s) => (
                      <th key={s.id} className="whitespace-nowrap px-2 pb-1 text-xs font-semibold text-slate-600" title={s.label}>
                        {s.emoji ? `${s.emoji} ` : ""}
                        {SEG_SHORT[s.id] ?? s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {caps.map((c) => (
                    <tr key={c.id}>
                      <th className="whitespace-nowrap px-2 align-middle text-sm font-semibold text-slate-900" title={c.help}>
                        {CAP_SHORT[c.id] ?? c.label}
                        <span className="block text-xs font-normal text-slate-500">{c.enforced ? "Bắt buộc" : "Hướng dẫn"}</span>
                      </th>
                      {segs.map((s) => (
                        <td key={s.id} className="align-middle">
                          {cell(c.id, s.id)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className={`${cls.card} overflow-hidden`}>
            <p className="px-4 py-3 text-sm font-semibold text-slate-900">Quyền tạm thời</p>
            {temporary.length === 0 ? (
              <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 text-pretty">
                Chưa có quyền tạm thời. Giao nhanh trên Telegram: <code className="rounded bg-slate-100 px-1 text-xs text-slate-700">/quyen them giờ tối đa 2h, 08:00–23:00, đến 31/12</code>
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {temporary.map((r) => {
                  const d = a(r);
                  return (
                    <div key={r.id} role="button" tabIndex={0} onClick={() => pickRow(r.id)} onKeyDown={(e) => e.key === "Enter" && pickRow(r.id)} className={`${cls.row} items-center ${sel === r.id ? cls.rowSel : ""}`}>
                      <Icon name="zap" className="size-4 text-slate-500" />
                      <span className="min-w-0 flex-1 text-sm text-slate-800">
                        {CAP_SHORT[d.capability ?? ""] ?? d.capability} · {segName(d.segment ?? "any", segs)} → <b>{DECIDER_LABEL[d.decider ?? "manager"]}</b> {limitText(d)}
                        <span className="block text-xs text-slate-500">
                          {d.from && d.to ? `${d.from}–${d.to}` : "Cả ngày"}
                          {d.validUntil ? ` · đến ${new Date(d.validUntil).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : ""}
                        </span>
                      </span>
                      <Switch checked={r.isActive} onChange={(on) => ctx.toggleRow("authority", r, on)} label="Bật quyền tạm thời" disabled={!ctx.canEdit} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      }
    />
  );
}

function segName(id: string, segs: Array<{ id: string; label: string; emoji: string }>) {
  const s = segs.find((x) => x.id === id);
  return s ? `${s.emoji ? `${s.emoji} ` : ""}${s.label}` : id;
}
