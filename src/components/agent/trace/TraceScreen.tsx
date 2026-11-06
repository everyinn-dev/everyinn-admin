"use client";

/**
 * AI-9 "Truy vết AI" (owner 2026-11-06, wireframe A + "dạng các node flow"): runs on the left, the turn as a node
 * flow in the middle (phases: Hiểu khách → Quyết định → Suy nghĩ & gọi tool → Kiểm tra & trả lời; tool nodes
 * branch off the LLM round that called them), the selected node's input / output on the right. Below 1280 px the
 * detail slides in from the right; below 1024 px list and flow are two views and the detail is a bottom sheet.
 */
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AgentApiError } from "@/lib/agentApi";
import { fmtMs, KIND_META, PHASES, runKind, traceApi, type RunDetail, type RunFilter, type RunStep, type RunSummary } from "@/lib/agentTrace";
import { fmtVn } from "@/lib/agentOps";
import { btn, cls, ErrorBlock, Icon } from "../ops/ui";

const FILTERS: Array<[RunFilter, string]> = [
  ["all", "Tất cả"],
  ["llm", "LLM"],
  ["fixed", "Cố định"],
  ["problem", "Vấn đề"],
];

function useWidth() {
  const [w, setW] = useState(1440);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

function Tag({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "brand" | "warn" | "danger" }) {
  const t = { slate: "bg-slate-100 text-slate-700", brand: "bg-emerald-50 text-emerald-800", warn: "bg-amber-50 text-amber-800", danger: "bg-rose-50 text-rose-700" }[tone];
  return <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${t}`}>{children}</span>;
}

const levelDot = (l?: string) => (l === "error" ? "bg-rose-50 text-rose-700 ring-rose-200" : l === "warn" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-white text-slate-600 ring-slate-200");

/** A run row's problem line, from the run summary agent-core wrote. */
function problemOf(r: RunSummary): string | null {
  if (!r.hasProblem) return null;
  const g = /guard: ([^·]+)/.exec(r.summary)?.[1]?.trim();
  if (g) return `guard: ${g}`;
  if (/auto: /.test(r.summary)) return "chuyển quản lí tự động";
  return r.route === "error" ? "lượt lỗi" : "có vấn đề";
}

function RunRow({ r, selected, onClick }: { r: RunSummary; selected: boolean; onClick: () => void }) {
  const p = problemOf(r);
  return (
    <button type="button" role="option" aria-selected={selected} onClick={onClick} className={`${cls.row} ${selected ? cls.rowSel : ""}`}>
      <span className="w-10 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-slate-500">{fmtVn(r.createdAt).slice(6)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{r.guestText || r.intent || "—"}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Tag tone={r.route === "llm" ? "slate" : "brand"}>{runKind(r)}</Tag>
          {r.scenario ? <Tag>{r.scenario}</Tag> : null}
          <span className="text-xs tabular-nums text-slate-500">
            {fmtMs(r.latencyMs)}
            {r.neurons ? ` · ${r.neurons} neuron` : ""}
          </span>
        </span>
        {p ? (
          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-800">
            <Icon name="triangle-alert" className="size-3.5" />
            {p}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function Summary({ run }: { run: RunDetail }) {
  const reply = run.steps?.find((s) => s.kind === "reply")?.output as { text?: string } | undefined;
  const p = problemOf(run);
  return (
    <section className={`${cls.card} p-4`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500">
            {run.senderName ?? "Khách"} · {fmtVn(run.createdAt)}
          </p>
          <p className="mt-0.5 text-[15px] font-semibold text-slate-900 text-pretty">{run.guestText || run.intent}</p>
        </div>
        {p ? <Tag tone="warn">{p}</Tag> : <Tag tone="brand">Ổn</Tag>}
      </div>
      {reply?.text ? (
        <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Home: </span>
          {reply.text}
        </p>
      ) : null}
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Đường đi</dt>
          <dd className="font-medium text-slate-900">
            {runKind(run)}
            {run.scenario ? ` · ${run.scenario}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Model</dt>
          <dd className="break-all font-medium text-slate-900">{run.modelId?.split("/").pop() ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Tổng thời gian</dt>
          <dd className="font-medium tabular-nums text-slate-900">{fmtMs(run.latencyMs)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Chi phí</dt>
          <dd className="font-medium tabular-nums text-slate-900">{run.neurons ?? 0} neuron</dd>
        </div>
      </dl>
    </section>
  );
}

/** One node of the flow. */
function Node({ s, selected, branch, onClick }: { s: RunStep; selected: boolean; branch?: boolean; onClick: () => void }) {
  const k = KIND_META[s.kind] ?? KIND_META.input;
  const slow = (s.ms ?? 0) >= 5000;
  return (
    <div className={`relative ${branch ? "pl-10" : ""}`}>
      {branch ? <span aria-hidden="true" className="absolute left-[19px] top-0 h-6 w-6 rounded-bl-xl border-b border-l border-slate-300" /> : null}
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`relative z-10 flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
          selected ? "border-emerald-700 bg-emerald-50" : s.level === "error" ? "border-rose-200 bg-white hover:bg-rose-50" : s.level === "warn" ? "border-amber-200 bg-white hover:bg-amber-50" : "border-slate-200 bg-white hover:bg-slate-100"
        }`}
      >
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ring-1 ${levelDot(s.level)}`}>
          <Icon name={k.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-xs font-semibold tabular-nums text-slate-500">{s.i}.</span>
            <span className="min-w-0 text-sm font-semibold text-slate-900 text-pretty">{s.label}</span>
          </span>
          {s.note ? <span className="mt-0.5 line-clamp-2 text-xs text-slate-500">{s.note}</span> : null}
        </span>
        <span className={`shrink-0 text-right text-xs tabular-nums ${slow ? "font-semibold text-amber-800" : "text-slate-500"}`}>{s.ms !== undefined ? fmtMs(s.ms) : `+${fmtMs(s.at)}`}</span>
      </button>
    </div>
  );
}

/** The turn as a node flow: phase groups on a rail, arrows between nodes, tools branching off their LLM round. */
function Flow({ steps, sel, onSel }: { steps: RunStep[]; sel: number | null; onSel: (i: number) => void }) {
  const groups = useMemo(() => {
    const out: Array<{ phase: (typeof PHASES)[number]; steps: RunStep[] }> = [];
    for (const s of steps) {
      const phase = PHASES.find((p) => (p.kinds as readonly string[]).includes(s.kind)) ?? PHASES[3];
      const last = out.at(-1);
      if (last && last.phase.id === phase.id) last.steps.push(s);
      else out.push({ phase, steps: [s] });
    }
    return out;
  }, [steps]);
  return (
    <section className={`${cls.card} p-3 sm:p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">Luồng xử lý ({steps.length} bước)</h3>
        <span className="hidden text-xs text-slate-500 sm:inline">bấm một node để xem input / output</span>
      </div>
      <ol className="grid gap-1">
        {groups.map((g, gi) => (
          <li key={`${g.phase.id}-${gi}`}>
            <div className="flex items-center gap-2 py-1.5">
              <span className="inline-flex h-6 items-center rounded-full bg-slate-900 px-2.5 text-xs font-semibold text-white">{g.phase.label}</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid gap-0">
              {g.steps.map((s, si) => {
                const branch = s.kind === "tool";
                const next = g.steps[si + 1];
                return (
                  <React.Fragment key={s.i}>
                    <Node s={s} selected={sel === s.i} branch={branch} onClick={() => onSel(s.i)} />
                    {next || gi < groups.length - 1 ? (
                      <span aria-hidden="true" className={`flex h-5 items-center ${next?.kind === "tool" ? "pl-[15px]" : branch ? "pl-[55px]" : "pl-[15px]"}`}>
                        <svg viewBox="0 0 10 20" className="h-5 w-2.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M5 0v16" />
                          <path d="m1.5 12.5 3.5 4 3.5-4" />
                        </svg>
                      </span>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const showVal = (v: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(String(v));
  return m ? `${m[4]} ${m[3]}/${m[2]}` : v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
};

function DiffTable({ a, b }: { a: Record<string, unknown>; b: Record<string, unknown> }) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => k !== "adjusted");
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">Model gửi / Hệ thống dùng</p>
      <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
        <span className="text-xs font-semibold text-slate-500">Trường</span>
        <span className="text-xs font-semibold text-slate-500">Model gửi</span>
        <span className="text-xs font-semibold text-slate-500">Hệ thống dùng</span>
        {keys.map((k) => {
          const diff = showVal(a[k]) !== showVal(b[k]);
          return (
            <React.Fragment key={k}>
              <span className="break-all font-mono text-slate-600">{k}</span>
              <span className="break-all font-mono text-slate-800">{showVal(a[k])}</span>
              <span className="break-all font-mono text-slate-800">{diff ? <span className="rounded bg-amber-50 px-1 font-semibold text-amber-800">{showVal(b[k])}</span> : showVal(b[k])}</span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  if (value === undefined || value === null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">{title}</p>
        <button
          type="button"
          className={btn("ghost", "sm")}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          <Icon name={copied ? "check" : "copy"} className="size-3.5" />
          {copied ? "Đã chép" : "Chép"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[12px] leading-5 text-slate-800">{text}</pre>
    </div>
  );
}

function StepDetail({ s, onClose }: { s: RunStep; onClose?: () => void }) {
  const k = KIND_META[s.kind] ?? KIND_META.input;
  const inp = s.input as { model_args?: Record<string, unknown>; used_args?: Record<string, unknown> } | undefined;
  const isTool = s.kind === "tool" && inp?.model_args && inp?.used_args;
  return (
    <div className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ring-1 ${levelDot(s.level)}`}>
          <Icon name={k.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500">
            Bước {s.i} · {k.name}
          </p>
          <p className="text-[15px] font-semibold text-slate-900 text-pretty">{s.label}</p>
        </div>
        <div className="text-right text-xs tabular-nums text-slate-500">
          <p>{s.ms !== undefined ? fmtMs(s.ms) : "—"}</p>
          <p>+{fmtMs(s.at)}</p>
        </div>
        {onClose ? (
          <button type="button" className={btn("ghost", "icon")} onClick={onClose} aria-label="Đóng">
            <Icon name="x" />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {s.note ? <p className={`rounded-xl px-3 py-2 text-sm ${s.level === "warn" ? "bg-amber-50 text-amber-800" : s.level === "error" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700"}`}>{s.note}</p> : null}
        {isTool ? <DiffTable a={inp!.model_args!} b={inp!.used_args!} /> : <JsonBlock title="Input" value={s.input} />}
        <JsonBlock title="Output" value={s.output} />
      </div>
    </div>
  );
}

export function TraceScreen() {
  const width = useWidth();
  const three = width >= 1280;
  const narrow = width < 1024;
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RunFilter>("all");
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [listErr, setListErr] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [view, setView] = useState<"list" | "flow">("list");
  const [reload, setReload] = useState(0);

  // ?conversationId=&run= (from the inbox "Xem từng bước")
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setConversationId(p.get("conversationId"));
    const r = p.get("run");
    if (r) {
      setRunId(r);
      setView("flow");
    }
  }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    if (conversationId) p.set("conversationId", conversationId);
    if (runId) p.set("run", runId);
    window.history.replaceState(null, "", `${window.location.pathname}${p.toString() ? `?${p}` : ""}`);
  }, [conversationId, runId]);

  const loadRuns = useCallback(
    async (more = false) => {
      setListErr(false);
      try {
        const d = await traceApi.list({ conversationId, filter, before: more ? nextBefore : null });
        setRuns((cur) => (more && cur ? [...cur, ...d.runs] : d.runs));
        setNextBefore(d.nextBefore);
        setRunId((cur) => cur ?? d.runs[0]?.id ?? null);
      } catch {
        setListErr(true);
        if (!more) setRuns([]);
      }
    },
    [conversationId, filter, nextBefore],
  );
  useEffect(() => {
    setRuns(null);
    loadRuns(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, filter]);

  useEffect(() => {
    if (!runId) return;
    let off = false;
    setRun(null);
    setRunErr(null);
    traceApi
      .get(runId)
      .then((r) => {
        if (off) return;
        setRun(r);
        // open the first node with a problem (or the first tool), else the reply
        const st = r.steps ?? [];
        setStep((st.find((s) => s.level && s.level !== "info") ?? st.find((s) => s.kind === "tool") ?? st.at(-1))?.i ?? null);
      })
      .catch((e) => !off && setRunErr(e instanceof AgentApiError ? e.message : "Không tải được lượt này."));
    return () => {
      off = true;
    };
  }, [runId, reload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = run?.steps?.find((s) => s.i === step) ?? null;
  const pick = (i: number) => {
    setStep(i);
    setSheet(true);
  };

  const list = (
    <>
      <div className="grid grid-cols-2 gap-2 px-4 py-3">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium ${filter === id ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}>
            {id === "problem" ? <Icon name="triangle-alert" className="size-3.5" /> : null}
            {label}
          </button>
        ))}
      </div>
      <div className="border-t border-slate-200">
        {runs === null ? (
          <div aria-busy="true" className="divide-y divide-slate-100">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <div className="h-4 w-10 animate-pulse rounded bg-slate-200/70" />
                <div className="grid flex-1 gap-2">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200/70" />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-slate-200/70" />
                </div>
              </div>
            ))}
          </div>
        ) : listErr ? (
          <div className="p-4">
            <ErrorBlock what="danh sách lượt AI" onRetry={() => loadRuns(false)} />
          </div>
        ) : runs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">Chưa có lượt AI nào</p>
            <p className="mt-1 text-sm text-slate-500 text-pretty">{filter === "problem" ? "Không có lượt nào có vấn đề. Home đang trả lời ổn." : "Nhắn thử trong Sandbox để xem các bước Home làm."}</p>
          </div>
        ) : (
          <div role="listbox" aria-label="Các lượt AI" className="divide-y divide-slate-100">
            {runs.map((r) => (
              <RunRow
                key={r.id}
                r={r}
                selected={runId === r.id}
                onClick={() => {
                  setRunId(r.id);
                  setView("flow");
                  setSheet(false);
                }}
              />
            ))}
            {nextBefore ? (
              <div className="p-3">
                <button type="button" className={`${btn("outline", "sm")} w-full`} onClick={() => loadRuns(true)}>
                  Xem lượt cũ hơn
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );

  const middle = (
    <div className="min-w-0 space-y-4 p-3 sm:p-5">
      {narrow ? (
        <button type="button" className={btn("ghost", "sm")} onClick={() => setView("list")}>
          <Icon name="chevron-left" className="size-4" />
          Các lượt
        </button>
      ) : null}
      {runErr ? (
        <ErrorBlock what="lượt AI này" onRetry={() => setReload((n) => n + 1)} />
      ) : !run ? (
        runs && runs.length === 0 ? null : (
          <div className={`${cls.card} grid gap-3 p-4`} aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <div className="size-8 animate-pulse rounded-lg bg-slate-200/70" />
                <div className="grid flex-1 gap-2">
                  <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200/70" />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-slate-200/70" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <Summary run={run} />
          {run.steps?.length ? (
            <Flow steps={run.steps} sel={step} onSel={pick} />
          ) : (
            <div className={`${cls.card} px-4 py-10 text-center`}>
              <p className="text-sm font-semibold text-slate-900">Lượt này chưa có các bước</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 text-pretty">
                Truy vết từng bước có từ 06/11 (bước cũ hơn 30 ngày được dọn). Lượt này chỉ có tóm tắt: <span className="font-medium text-slate-700">{run.summary || run.intent}</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
        <Link href={conversationId ? `/agent-inbox?c=${encodeURIComponent(conversationId)}` : "/agent-inbox"} className={btn("ghost", "icon")} aria-label="Đóng, về Hộp thư AI" title="Đóng, về Hộp thư AI">
          <Icon name="x" className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">Truy vết AI</p>
          <p className="hidden truncate text-xs text-slate-500 sm:block">Mỗi lượt Home trả lời: làm gì, làm thế nào, input và output từng bước</p>
        </div>
        {conversationId ? (
          <button type="button" className={btn("outline", "sm")} onClick={() => setConversationId(null)} title="Bỏ lọc hội thoại">
            {runs?.[0]?.senderName ?? "Hội thoại"}
            <Icon name="x" className="size-3.5" />
          </button>
        ) : null}
      </header>

      {narrow ? (
        <>
          {view === "list" ? <div className="bg-white">{list}</div> : middle}
          {view === "flow" && sheet && selected ? (
            <>
              <div className="fixed inset-0 z-40 bg-slate-900/25" onClick={() => setSheet(false)} />
              <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-[0_-8px_24px_rgb(15_23_42/.1)]">
                <StepDetail s={selected} onClose={() => setSheet(false)} />
              </aside>
            </>
          ) : null}
        </>
      ) : three ? (
        <div className="grid min-h-[calc(100vh-56px)] grid-cols-[300px_minmax(0,1fr)_460px]">
          <aside className="sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-r border-slate-200 bg-white">{list}</aside>
          {middle}
          <aside className="sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-l border-slate-200 bg-white">{selected ? <StepDetail s={selected} /> : null}</aside>
        </div>
      ) : (
        <>
          <div className="grid min-h-[calc(100vh-56px)] grid-cols-[288px_minmax(0,1fr)]">
            <aside className="sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-r border-slate-200 bg-white">{list}</aside>
            {middle}
          </div>
          <div className={`fixed inset-0 z-40 bg-slate-900/25 transition-opacity ${sheet && selected ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setSheet(false)} />
          <aside className={`fixed inset-y-0 right-0 z-50 w-[480px] overflow-y-auto bg-white shadow-[-8px_0_24px_rgb(15_23_42/.08)] transition-transform ${sheet && selected ? "translate-x-0" : "translate-x-full"}`} aria-hidden={!(sheet && selected)}>
            {selected ? <StepDetail s={selected} onClose={() => setSheet(false)} /> : null}
          </aside>
        </>
      )}
    </div>
  );
}
