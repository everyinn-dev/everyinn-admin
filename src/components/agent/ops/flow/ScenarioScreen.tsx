"use client";

/**
 * AI-11 Đợt 2 — "Kịch bản" = workflow builder (owner 2026-11-07: "dựng luôn"; layout = vertical steps with branches,
 * the common pattern of step-based automation builders for non-engineers, drawn as nodes like Truy vết AI).
 *   list: every kịch bản with its "Khi nào", step count, runs (7 days) and runs waiting now
 *   editor: Khi nào card · steps (node + branches + insert) · checklist · Chạy thử · right panel = step / Lời dặn
 * Everything comes from agent-core's registry (actions, params, outcomes) — a new action needs no admin change.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { agentApi, AgentApiError } from "@/lib/agentApi";
import { ACT_LABEL, PHASE_LABEL, STAGE_LABEL, fmtVn, opsApi, type FlowAction, type FlowStep, type MdData, type MdRow, type ScenarioStat } from "@/lib/agentOps";
import { useToast } from "@/components/ui/Toast";
import { Chips, EmptyLine, Field, Icon, PanelHead, ScreenHead, SearchBox, Switch, btn, cls } from "../ui";
import { SplitLayout, type OpsCtx } from "../AgentOps";
import { StepPanel } from "./StepPanel";
import { ACTION_ICON, END, LLM, checklist, insertStep, moveStep, outcomesOf, removeStep, summaryOf, targetLabel, targetOf } from "./model";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
const flowOf = (d: MdData): FlowStep[] => (Array.isArray(d.flow) ? (d.flow as FlowStep[]) : []);

export function ScenarioScreen({ ctx }: { ctx: OpsCtx }) {
  const rows = ctx.rows.scenarios;
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [stats, setStats] = useState<ScenarioStat[] | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("kb");
    if (id) setOpenId(id);
    opsApi.scenarioStats().then(setStats).catch(() => setStats([]));
  }, []);
  const open = useCallback((id: string | null) => {
    setOpenId(id);
    setCreating(false);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("kb", id);
    else url.searchParams.delete("kb");
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }, []);

  const row = rows.find((r) => r.id === openId) ?? null;
  if (creating || row) return <FlowEditor key={creating ? "new" : row!.id} ctx={ctx} row={creating ? null : row} onBack={() => open(null)} onCreated={(r) => open(r.id)} />;

  const statOf = (id: string) => stats?.find((s) => s.scenario === id);
  const shown = rows
    .filter((r) => !q.trim() || fold([r.id, str(r.data.title), str(r.data.when), str(r.data.goal)].join(" ")).includes(fold(q.trim())))
    .sort((a, b) => Number(flowOf(b.data).length > 0) - Number(flowOf(a.data).length > 0) || a.sort - b.sort);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <ScreenHead
        title="Kịch bản"
        desc="Mỗi kịch bản là một quy trình: Khi nào chạy · Các bước Home làm · Lời dặn khi khách hỏi chen. Kịch bản chưa có bước thì Home trả lời theo Lời dặn."
        action={
          ctx.canEdit ? (
            <button type="button" className={btn("primary")} onClick={() => setCreating(true)}>
              <Icon name="plus" />
              Thêm kịch bản
            </button>
          ) : undefined
        }
      />
      {rows.length > 0 && (
        <div className="flex justify-end">
          <SearchBox value={q} onChange={setQ} placeholder="Tìm kịch bản" />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyLine>Chưa có kịch bản nào. Home dùng kịch bản mặc định.</EmptyLine>
      ) : shown.length === 0 ? (
        <EmptyLine>Không có kịch bản nào khớp “{q}”.</EmptyLine>
      ) : (
        <div className={`${cls.card} overflow-hidden`}>
          <ul className="divide-y divide-slate-100" aria-label="Kịch bản">
            {shown.map((r) => {
              const steps = flowOf(r.data).length;
              const st = statOf(r.id);
              return (
                <li key={r.id} className={`${cls.row} ${r.isActive ? "" : "opacity-70"}`} onClick={() => open(r.id)}>
                  <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${steps ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                    <Icon name={steps ? "list-tree" : "file-text"} />
                  </span>
                  <button type="button" className="min-w-0 flex-1 text-left focus:outline-none" onClick={() => open(r.id)}>
                    <span className="block text-sm font-semibold text-slate-900">{str(r.data.title) || r.id}</span>
                    <span className="mt-0.5 line-clamp-1 text-xs text-slate-500">{str(r.data.when) ? `Khi: ${str(r.data.when)}` : str(r.data.goal)}</span>
                    <span className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-xs text-slate-500">
                      <span className={steps ? "font-semibold text-slate-700" : ""}>{steps ? `${steps} bước` : "Chỉ lời dặn"}</span>
                      {st?.waiting ? <span className="rounded-full bg-amber-50 px-1.5 font-semibold text-amber-800">{st.waiting} đang chờ</span> : null}
                      {st?.runs7d ? <span>{st.runs7d} lần / 7 ngày</span> : null}
                      {st?.lastAt ? <span className="hidden truncate sm:inline">gần nhất {fmtVn(st.lastAt)}</span> : null}
                    </span>
                  </button>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Switch checked={r.isActive} onChange={(on) => ctx.toggleRow("scenarios", r, on)} label={`Bật ${str(r.data.title) || r.id}`} disabled={!ctx.canEdit} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function FlowEditor({ ctx, row, onBack, onCreated }: { ctx: OpsCtx; row: MdRow | null; onBack: () => void; onCreated: (r: MdRow) => void }) {
  const toast = useToast();
  const actions: FlowAction[] = ctx.registry.actions ?? [];
  const labels = ctx.registry.outcomeLabels ?? {};
  const field = (name: string) => ctx.registry.collections.find((c) => c.id === "scenarios")?.fields.find((f) => f.name === name);
  const initial: MdData = useMemo(() => row?.data ?? { title: "", goal: "", steps: [], when: "", acts: [], phases: [], stages: [], keywords: [], priority: 100, flow: [] }, [row]);
  const [data, setData] = useState<MdData>(initial);
  const [sel, setSel] = useState<number | "advice" | null>(null);
  const [picker, setPicker] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const flow = flowOf(data);
  const set = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }));
  const setFlow = (f: FlowStep[]) => set("flow", f);
  const dirty = JSON.stringify(data) !== JSON.stringify(initial);
  const templateKeys = [...new Set(ctx.rows.templates.map((t) => str(t.data.key)))];
  const issues = checklist(flow, actions, templateKeys, ctx.rows.scenarios.map((s) => s.id));
  const canEdit = ctx.canEdit;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    if (!str(data.title).trim()) return toast.error("Đặt tên kịch bản trước khi lưu.");
    if (!str(data.goal).trim()) {
      setSel("advice");
      return toast.error("Thiếu “Mục tiêu” trong Lời dặn cho Home.");
    }
    if (issues.length) return toast.error(`Còn ${issues.length} lỗi trong danh sách kiểm tra.`);
    setSaving(true);
    try {
      const clean = { ...data, flow: flow.map((s) => ({ ...s, title: s.title?.trim() || undefined })) };
      const saved = row ? await opsApi.update("scenarios", row.id, { data: clean, expectedVersion: row.version }) : await opsApi.create("scenarios", { data: clean });
      ctx.putRow("scenarios", saved);
      toast.success("Đã lưu. Home dùng bản mới sau ~15 giây.");
      if (!row) onCreated(saved);
      else setData(saved.data);
    } catch (e) {
      if (e instanceof AgentApiError && e.status === 409) {
        toast.warning("Kịch bản vừa được sửa ở nơi khác — đã tải lại, bạn sửa lại giúp nhé.");
        ctx.reload();
      } else toast.error(e instanceof AgentApiError ? e.message : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  };

  const selStep = typeof sel === "number" ? sel : null;
  const panel =
    selStep !== null && flow[selStep] ? (
      <StepPanel
        flow={flow}
        index={selStep}
        actions={actions}
        outcomeLabels={labels}
        templates={ctx.rows.templates}
        scenarios={ctx.rows.scenarios}
        selfId={row?.id ?? null}
        canEdit={canEdit}
        onChange={(s) => setFlow(flow.map((x, i) => (i === selStep ? s : x)))}
        onMove={(d) => {
          setFlow(moveStep(flow, selStep, d));
          setSel(Math.max(0, Math.min(flow.length - 1, selStep + d)));
        }}
        onDelete={() => {
          setFlow(removeStep(flow, flow[selStep].id));
          setSel(null);
        }}
        onClose={() => setSel(null)}
      />
    ) : (
      <AdvicePanel data={data} set={set} canEdit={canEdit} onClose={() => setSel(null)} toolsOptions={field("tools")?.options ?? []} />
    );

  const Start = (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
      <Icon name="zap" className="size-3.5 text-emerald-700" />
      Bắt đầu khi khớp “Khi nào”
    </div>
  );

  const insert = (at: number, last?: boolean) =>
    canEdit ? (
      <div className="relative flex flex-col items-center">
        <button
          type="button"
          onClick={() => setPicker(picker === at ? null : at)}
          aria-expanded={picker === at}
          className={last ? `${btn("outline", "sm")}` : "grid size-8 place-items-center rounded-full border border-slate-300 bg-white text-slate-600 hover:border-emerald-700 hover:text-emerald-800"}
          aria-label={last ? undefined : `Chèn bước ở vị trí ${at + 1}`}
          title={last ? undefined : "Chèn bước"}
        >
          <Icon name="plus" className="size-3.5" />
          {last ? "Thêm bước" : null}
        </button>
        {picker === at ? (
          <div className="z-20 mt-2 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-2 shadow-lg" role="menu">
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  setFlow(insertStep(flow, at, a));
                  setPicker(null);
                  setSel(at);
                }}
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon name={ACTION_ICON[a.id] ?? "route"} className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{a.label}</span>
                  <span className="line-clamp-2 text-xs text-slate-500">{a.help}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    ) : null;

  const connector = (k: string) => <span key={k} className="h-4 w-px bg-slate-300" aria-hidden="true" />;

  const main = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {leaveAsk ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-900" role="alert">
            Bỏ các thay đổi chưa lưu?
            <button type="button" className="font-semibold underline" onClick={onBack}>
              Bỏ
            </button>
            <button type="button" className="font-semibold" onClick={() => setLeaveAsk(false)}>
              Ở lại
            </button>
          </span>
        ) : (
          <button type="button" className={btn("ghost", "sm")} onClick={() => (dirty ? setLeaveAsk(true) : onBack())}>
            <Icon name="arrow-left" className="size-3.5" />
            Kịch bản
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {row ? <Switch checked={row.isActive} onChange={(on) => ctx.toggleRow("scenarios", row, on)} label="Bật kịch bản" disabled={!canEdit} /> : null}
          <button type="button" className={btn("outline", "sm")} onClick={() => setTestOpen((v) => !v)} aria-expanded={testOpen} disabled={!row}>
            <Icon name="play" className="size-3.5" />
            Chạy thử
          </button>
          {canEdit ? (
            <button type="button" className={btn("primary", "sm")} onClick={save} disabled={saving || (!dirty && !!row)}>
              {saving ? "Đang lưu…" : dirty || !row ? "Lưu" : "Đã lưu"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1">
        <input
          className="h-10 w-full rounded-lg bg-transparent text-xl font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:underline focus:decoration-emerald-700/40"
          value={str(data.title)}
          placeholder="Tên kịch bản"
          maxLength={80}
          disabled={!canEdit}
          onChange={(e) => set("title", e.target.value)}
          aria-label="Tên kịch bản"
        />
        <p className="text-xs text-slate-500">
          {row ? `${row.isSystem ? "Kịch bản hệ thống" : "Kịch bản tự tạo"} · ${row.id}` : "Kịch bản mới — lưu xong Home dùng sau ~15 giây"}
          {" · "}
          <button type="button" className="font-medium text-emerald-800 hover:underline" onClick={() => setSel("advice")}>
            Lời dặn cho Home
          </button>
        </p>
      </div>

      {testOpen && row ? <TestRun scenarioTitle={str(data.title)} dirty={dirty} /> : null}

      {issues.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Icon name="triangle-alert" className="size-4" />
            Cần sửa {issues.length} chỗ trước khi lưu
          </p>
          <ul className="mt-2 grid gap-1 text-xs text-amber-900">
            {issues.map((it, i) => (
              <li key={i}>
                {it.stepId ? (
                  <button type="button" className="text-left hover:underline" onClick={() => setSel(flow.findIndex((s) => s.id === it.stepId))}>
                    {it.text}
                  </button>
                ) : (
                  it.text
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className={`${cls.card} grid gap-4 p-4 sm:p-5`} aria-labelledby="kb-when">
        <div>
          <h2 id="kb-when" className="text-sm font-bold text-slate-900">
            Khi nào chạy
          </h2>
          <p className={cls.help}>AI điều phối đọc câu mô tả để chọn kịch bản; Ý khách và Lúc đang là điều kiện chắc chắn.</p>
        </div>
        <Field label="Mô tả bằng lời">
          <textarea className={`${cls.fld} ${cls.area}`} rows={3} maxLength={300} disabled={!canEdit} value={str(data.when)} placeholder="Ví dụ: Khi khách đã trả phòng nhắn là để quên đồ ở phòng" onChange={(e) => set("when", e.target.value)} />
        </Field>
        <div className="grid gap-4">
          <Field label="Ý khách" as="div">
            <Chips options={(field("acts")?.options ?? []).map((o) => [o, ACT_LABEL[o] ?? o])} value={list(data.acts)} onChange={(v) => set("acts", v)} disabled={!canEdit} wrap />
          </Field>
          <>
            <Field label="Lúc đang (trống = lúc nào cũng được)" as="div">
              <Chips options={(field("phases")?.options ?? []).map((o) => [o, PHASE_LABEL[o] ?? o])} value={list(data.phases)} onChange={(v) => set("phases", v)} disabled={!canEdit} />
            </Field>
            <Field label="Giai đoạn khách (trống = mọi giai đoạn)" as="div">
              <Chips options={(field("stages")?.options ?? []).map((o) => [o, STAGE_LABEL[o] ?? o])} value={list(data.stages)} onChange={(v) => set("stages", v)} disabled={!canEdit} />
            </Field>
          </>
        </div>
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">Từ khoá dự phòng ({list(data.keywords).length}) · độ ưu tiên {String(data.priority ?? 0)}</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Field label="Từ khoá (mỗi dòng một cụm, không dấu cũng được)" help="Dùng khi AI điều phối đang tắt / chạy thử.">
              <textarea className={`${cls.fld} ${cls.area}`} rows={4} disabled={!canEdit} value={list(data.keywords).join("\n")} onChange={(e) => set("keywords", e.target.value.split("\n"))} onBlur={(e) => set("keywords", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
            </Field>
            <Field label="Độ ưu tiên">
              <input type="number" min={0} max={1000} className={`${cls.fld} ${cls.input}`} disabled={!canEdit} value={String(data.priority ?? 0)} onChange={(e) => set("priority", Number(e.target.value))} />
            </Field>
          </div>
        </details>
      </section>

      <section aria-labelledby="kb-steps" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="kb-steps" className="text-sm font-bold text-slate-900">
            Các bước
          </h2>
          <span className="text-xs text-slate-500">{flow.length ? `${flow.length} bước · bấm một bước để sửa` : "Chưa có bước — Home trả lời theo Lời dặn"}</span>
        </div>
        <div className="flex flex-col items-center">
          {Start}
          {connector("start")}
          {flow.map((s, i) => {
            const a = actions.find((x) => x.id === s.action);
            const outs = outcomesOf(s, a, labels);
            const branches = outs.map((o) => ({ ...o, target: targetOf(flow, i, o.key) }));
            const showBranches = branches.length > 1 || branches.some((b) => b.target === END || b.target === LLM || b.target.startsWith("scenario:") || (flow[i + 1] && b.target !== flow[i + 1].id));
            const bad = issues.some((it) => it.stepId === s.id);
            const waitsFor = a?.waits ? (s.action === "ask_guest" ? "Chờ khách" : s.action === "notify_owner" ? (s.params?.wait ? "Chờ quản lí" : null) : s.action === "ask_both" ? "Chờ khách + quản lí" : null) : null;
            return (
              <React.Fragment key={s.id}>
                <div className="w-full max-w-xl">
                  <button
                    type="button"
                    onClick={() => setSel(i)}
                    aria-current={sel === i ? "true" : undefined}
                    className={`flex w-full items-start gap-3 rounded-2xl border bg-white p-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${sel === i ? "border-emerald-700 bg-emerald-50/40 shadow-[inset_3px_0_0_#047857] hover:bg-emerald-50/60" : bad ? "border-amber-300" : "border-[#e8edf3]"}`}
                  >
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${s.action === "end" ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-800"}`}>
                      <Icon name={ACTION_ICON[s.action] ?? "route"} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-900">
                        <span className="tabular-nums text-slate-500">{i + 1}.</span>
                        {s.title || a?.label || s.action}
                        {waitsFor ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 text-xs font-semibold leading-5 text-amber-800">
                            <Icon name="hourglass" className="size-3" />
                            {waitsFor}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{a?.label ?? "Chưa chọn hành động"}</span>
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-700">{summaryOf(s, a, ctx.rows.templates, ctx.rows.scenarios)}</span>
                    </span>
                  </button>
                  {showBranches ? (
                    <ul className="ml-6 mt-1.5 grid gap-1 border-l-2 border-slate-200 pl-3">
                      {branches.map((b) => (
                        <li key={b.key} className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-medium text-slate-700">{b.label}</span>
                          <Icon name="chevron-right" className="size-3 text-slate-400" />
                          <span className={b.target === END ? "text-slate-500" : "font-semibold text-emerald-800"}>{targetLabel(flow, b.target, ctx.rows.scenarios)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {i < flow.length - 1 ? (
                  <>
                    {connector(`a${i}`)}
                    {insert(i + 1)}
                    {connector(`b${i}`)}
                  </>
                ) : null}
              </React.Fragment>
            );
          })}
          {flow.length ? connector("end") : null}
          {insert(flow.length, true)}
        </div>
      </section>
    </>
  );

  return <SplitLayout open={sel !== null} onClose={() => setSel(null)} panel={panel} list={main} />;
}

function AdvicePanel({ data, set, canEdit, onClose, toolsOptions }: { data: MdData; set: (k: string, v: unknown) => void; canEdit: boolean; onClose: () => void; toolsOptions: string[] }) {
  return (
    <div className="flex min-h-full flex-col">
      <PanelHead title="Lời dặn cho Home" sub="Home đọc khi khách hỏi chen giữa các bước" onBack={onClose} />
      <div className="grid content-start gap-5 px-5 py-5">
        <Field label="Mục tiêu *">
          <textarea className={`${cls.fld} ${cls.area}`} rows={4} maxLength={600} disabled={!canEdit} value={str(data.goal)} onChange={(e) => set("goal", e.target.value)} />
        </Field>
        <Field label="Các bước nói chuyện (mỗi dòng một ý)" help="Cách Home nói, không phải các bước hệ thống chạy.">
          <textarea className={`${cls.fld} ${cls.area}`} rows={6} disabled={!canEdit} value={list(data.steps).join("\n")} onChange={(e) => set("steps", e.target.value.split("\n"))} onBlur={(e) => set("steps", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
        </Field>
        {toolsOptions.length ? (
          <Field label="Công cụ AI được dùng (trống = mọi công cụ)" as="div">
            <Chips options={toolsOptions.map((t) => [t, t])} value={list(data.tools)} onChange={(v) => set("tools", v)} disabled={!canEdit} wrap />
          </Field>
        ) : null}
      </div>
    </div>
  );
}

/** Send one guest line to a fresh Sandbox conversation and show Home's answer + a link to the step trace. */
function TestRun({ scenarioTitle, dirty }: { scenarioTitle: string; dirty: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [conv, setConv] = useState<string | null>(null);
  const [replies, setReplies] = useState<Array<{ who: "guest" | "home"; text: string }>>([]);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    const mine = text.trim();
    setReplies((r) => [...r, { who: "guest", text: mine }]);
    setText("");
    try {
      const res = await agentApi<{ conversation: { id: string }; messages: Array<{ text: string; senderType: string }> }>("sandbox/messages", { method: "POST", body: { text: mine, wait: true, ...(conv ? { conversationId: conv } : {}) } });
      if (res.data) {
        setConv(res.data.conversation.id);
        const last = res.data.messages.at(-1);
        setReplies((r) => [...r, { who: "home", text: last && last.senderType !== "guest" ? last.text : "(Home đang đợi khách nhắn hết ý — gửi thêm hoặc chờ 30 giây)" }]);
      }
    } catch (e) {
      setErr(e instanceof AgentApiError ? e.message : "Không gửi được.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Chạy thử">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">Chạy thử “{scenarioTitle}”</p>
        {conv ? (
          <Link href={`/agent-inbox/truy-vet?conversationId=${encodeURIComponent(conv)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline" target="_blank">
            Xem từng bước
            <Icon name="external-link" className="size-3" />
          </Link>
        ) : null}
      </div>
      <p className={cls.help}>
        Nhắn như khách trong một hội thoại Sandbox mới (khách mới, chưa có booking).{dirty ? " Bản chưa lưu không được chạy — lưu trước rồi thử." : ""} Thẻ Telegram vẫn gửi thật cho quản lí.
      </p>
      {replies.length ? (
        <div className="grid gap-2">
          {replies.map((m, i) => (
            <p key={i} className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-6 ${m.who === "guest" ? "justify-self-end bg-emerald-700 text-white" : "justify-self-start bg-white text-slate-900 shadow-[0_0_0_1px_rgb(15_23_42/.06)]"}`}>
              {m.text}
            </p>
          ))}
        </div>
      ) : null}
      {err ? <p className="text-xs text-rose-700">{err}</p> : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input className={`${cls.fld} ${cls.input}`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ví dụ: mình để quên cái bóp ở phòng" disabled={busy} aria-label="Tin khách thử" />
        <button type="submit" className={btn("primary")} disabled={busy || !text.trim()}>
          {busy ? "Đang gửi…" : "Gửi"}
        </button>
      </form>
    </section>
  );
}
