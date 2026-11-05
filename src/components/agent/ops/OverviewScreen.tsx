"use client";

/** Tổng quan: what Home follows, what waits for the manager (proposals + delegation suggestions), recent edits. */
import React, { useState } from "react";
import { AgentApiError } from "@/lib/agentApi";
import { DECIDER_LABEL, editorLabel, fmtVn, opsApi, type CollectionId, type Decider, type MdRow } from "@/lib/agentOps";
import { useToast } from "@/components/ui/Toast";
import { Icon, ScreenHead, Tag, btn, cls } from "./ui";
import type { OpsCtx, ScreenId } from "./AgentOps";

const CAP_SHORT: Record<string, string> = { extend_stay: "Thêm giờ", deposit_exception: "Cọc sát ngày", discount: "Giảm giá", early_checkin: "Nhận sớm", late_checkout_free: "Trả muộn", refund_cancel: "Hoàn tiền" };
const SCREEN_OF: Record<CollectionId, ScreenId> = { rules: "so-luat", templates: "mau-tin", scenarios: "kich-ban", authority: "quyen", segments: "khach" };

export function OverviewScreen({ ctx }: { ctx: OpsCtx }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const segName = (id: string) => {
    if (id === "any") return "Mọi khách";
    const s = ctx.rows.segments.find((x) => x.id === id);
    return s ? `${s.data.emoji ? `${String(s.data.emoji)} ` : ""}${String(s.data.label ?? id)}` : id;
  };
  const capName = (id: string) => CAP_SHORT[id] ?? ctx.registry.capabilities.find((c) => c.id === id)?.label ?? id;
  const sugg = ctx.decisions?.suggestions ?? [];
  const sameAs = (r: MdRow, s: (typeof sugg)[number]) => r.data.capability === s.capability && r.data.segment === s.segment;
  // a proposal already covering a suggestion is shown once, as the suggestion
  const proposals = ctx.rows.authority.filter((r) => !r.isActive && r.isSystem && !sugg.some((s) => sameAs(r, s)));
  const summary = ctx.decisions?.summary ?? [];
  const tot = summary.reduce((t, a) => ({ all: t.all + a.approved + a.deal + a.rejected + a.auto + a.refused, auto: t.auto + a.auto, ok: t.ok + a.approved, deal: t.deal + a.deal, no: t.no + a.rejected, ref: t.ref + a.refused }), { all: 0, auto: 0, ok: 0, deal: 0, no: 0, ref: 0 });
  const activeRules = ctx.rows.rules.filter((r) => r.isActive).length;
  const activeAuth = ctx.rows.authority.filter((r) => r.isActive).length;
  const activeTpl = ctx.rows.templates.filter((r) => r.isActive).length;
  const recent = (Object.keys(ctx.rows) as CollectionId[])
    .flatMap((c) => ctx.rows[c].filter((r) => r.updatedBy && r.updatedBy !== "seed").map((r) => ({ c, r })))
    .sort((a, b) => b.r.updatedAt.localeCompare(a.r.updatedAt))
    .slice(0, 5);

  const lim = (d: Record<string, unknown>) => (d.maxHours ? `≤ ${d.maxHours} giờ` : d.maxPercent ? `≤ ${d.maxPercent}%` : "");
  const delegate = async (s: (typeof sugg)[number]) => {
    setBusy(`s:${s.capability}:${s.segment}`);
    const existing = ctx.rows.authority.find((r) => !r.isActive && sameAs(r, s) && r.data.decider === "ai");
    if (existing) {
      await ctx.toggleRow("authority", existing, true);
      ctx.reloadDecisions();
      setBusy(null);
      return;
    }
    try {
      const row = await opsApi.create("authority", { data: { capability: s.capability, segment: s.segment, decider: "ai", ...(s.maxHours ? { maxHours: s.maxHours } : {}), note: `Từ gợi ý tổng kết — đã duyệt ${s.approvals} lần` }, isActive: true });
      ctx.putRow("authority", row);
      ctx.reloadDecisions();
      toast.success("Đã giao cho Home. Lần sau Home tự chốt ngay.");
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Không giao được.");
    } finally {
      setBusy(null);
    }
  };
  const stat = (icon: string, label: string, n: number, sub: string) => (
    <div className={`${cls.card} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon name={icon} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{n}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
  const title = (c: CollectionId, r: MdRow) => {
    const d = r.data as Record<string, unknown>;
    if (c === "authority") return `${capName(String(d.capability))} · ${segName(String(d.segment))}`;
    return String(d.title ?? d.label ?? d.key ?? r.id);
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <ScreenHead title="Tổng quan" desc={`Home đang làm theo ${activeRules} luật, ${activeAuth} quyền và ${activeTpl} mẫu tin. Đây là chỗ xem có gì cần bạn duyệt.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat("gavel", "Quyết định 30 ngày", tot.all, "ngoại lệ Home gặp")}
        {stat("bot", "Home tự chốt", tot.auto, "theo Bảng quyền")}
        {stat("user-check", "Quản lí duyệt", tot.ok + tot.deal, `${tot.ok} duyệt · ${tot.deal} deal giá`)}
        {stat("ban", "Từ chối / chặn", tot.no + tot.ref, `${tot.no} từ chối · ${tot.ref} bị chặn`)}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className={`${cls.card} overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Cần bạn duyệt</h3>
            {sugg.length + proposals.length ? <Tag tone="warn">{sugg.length + proposals.length} việc</Tag> : null}
          </div>
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {sugg.length + proposals.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Không có gì cần bạn duyệt. Home đang làm đúng Sổ luật và Bảng quyền.</p> : null}
            {sugg.map((s) => (
              <div key={`${s.capability}:${s.segment}`} className="flex flex-wrap items-center gap-3 bg-emerald-50 px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-emerald-700">
                  <Icon name="sparkles" />
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-900 text-pretty">
                  <b>Giao quyền:</b> bạn đã duyệt {s.approvals}/{s.approvals} lần {segName(s.segment)} {capName(s.capability).toLowerCase()}
                  {s.maxHours ? ` (tối đa ${s.maxHours} giờ)` : ""}.<span className="block text-xs text-slate-600">Giao thì lần sau Home tự chốt ngay giá bảng.</span>
                </span>
                {ctx.canEdit ? (
                  <button type="button" className={btn("primary", "sm")} disabled={busy !== null} onClick={() => delegate(s)}>
                    Giao cho Home
                  </button>
                ) : null}
              </div>
            ))}
            {proposals.map((r) => {
              const d = r.data as Record<string, unknown>;
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 text-sm text-slate-800 text-pretty">
                    {capName(String(d.capability))} · {segName(String(d.segment))} → <b>{DECIDER_LABEL[d.decider as Decider] ?? String(d.decider)}</b> {lim(d)}
                  </span>
                  <button type="button" className={btn("ghost", "sm")} onClick={() => ctx.go("quyen")}>
                    Xem
                  </button>
                  {ctx.canEdit ? (
                    <button
                      type="button"
                      className={btn("outline", "sm")}
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(r.id);
                        await ctx.toggleRow("authority", r, true);
                        setBusy(null);
                      }}
                    >
                      Bật
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
        <section className={`${cls.card} overflow-hidden`}>
          <h3 className="px-4 py-3 text-sm font-bold text-slate-900">Quyết định theo việc · 30 ngày</h3>
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {ctx.decisions === null ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Đang tải…</p>
            ) : summary.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa có quyết định ngoại lệ nào trong 30 ngày.</p>
            ) : (
              summary.map((d) => {
                const good = d.approved + d.deal + d.auto;
                const bad = d.rejected + d.refused;
                const all = Math.max(1, good + bad);
                return (
                  <div key={`${d.capability}:${d.segment}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">
                        {capName(d.capability)} · {segName(d.segment)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        duyệt {d.approved}
                        {d.deal ? ` (+${d.deal} deal)` : ""} · từ chối {d.rejected} · Home tự chốt {d.auto}
                        {d.refused ? ` · bị chặn ${d.refused}` : ""}
                      </span>
                    </span>
                    <span className="flex h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100" aria-label={`${good} đồng ý, ${bad} không`}>
                      {good ? <span className="bg-emerald-700" style={{ width: `${(good / all) * 100}%` }} /> : null}
                      {bad ? <span className="bg-amber-600" style={{ width: `${(bad / all) * 100}%` }} /> : null}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Mỗi sáng thứ Hai 8:00 Home gửi bản này lên Telegram (hoặc gõ /baocao).</p>
        </section>
      </div>
      <section className={`${cls.card} overflow-hidden`}>
        <h3 className="px-4 py-3 text-sm font-bold text-slate-900">Sửa gần đây</h3>
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {recent.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa ai sửa gì — mọi thứ đang theo mẫu ban đầu.</p> : null}
          {recent.map(({ c, r }) => (
            <button key={`${c}:${r.id}`} type="button" onClick={() => ctx.go(SCREEN_OF[c])} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100">
              <span className="hidden w-24 shrink-0 text-xs font-semibold text-slate-500 sm:block">{ctx.registry.collections.find((x) => x.id === c)?.label}</span>
              <span className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
                <span className="block truncate text-sm text-slate-800 sm:flex-1">{title(c, r)}</span>
                <span className="block shrink-0 text-xs text-slate-500">
                  <span className="sm:hidden">{ctx.registry.collections.find((x) => x.id === c)?.label} · </span>
                  {editorLabel(r.updatedBy, ctx.myStaffId)} · {fmtVn(r.updatedAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
