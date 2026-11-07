"use client";

/** Sổ luật / Mẫu tin / Kịch bản: one generic list + editor, shaped by the registry (AI-7 W4). */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABEL, LAYER_LABEL, STAGE_LABEL, fillTemplate, type CollectionId, type MdData, type MdRow } from "@/lib/agentOps";
import { EmptyLine, FilterChip, Icon, ScreenHead, ScrollRow, SearchBox, Switch, btn, cls } from "./ui";
import { MdForm } from "./MdForm";
import { SplitLayout, type OpsCtx } from "./AgentOps";

type D = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const COPY: Record<"rules" | "templates" | "scenarios" | "stay_shifts", { title: string; desc: string; add: string; search: string; empty: string }> = {
  rules: {
    title: "Sổ luật",
    desc: "Home chỉ đọc những luật đang bật của kịch bản đang xử lý. Chính sách được nói với khách; quy ước và ngoại lệ là nội bộ.",
    add: "Thêm luật",
    search: "Tìm trong luật",
    empty: "Chưa có luật nào. Thêm luật đầu tiên để Home làm theo.",
  },
  templates: {
    title: "Mẫu tin",
    desc: "Câu Home gửi nguyên văn, không qua AI. Nhiều biến thể thì mỗi lần Home chọn một cho tự nhiên.",
    add: "Thêm mẫu",
    search: "Tìm câu hoặc mã mẫu",
    empty: "Chưa có mẫu tin nào. Home sẽ dùng câu mặc định của hệ thống.",
  },
  stay_shifts: {
    title: "Khung giờ",
    desc: "Các ca Home biết và việc Home được tự làm khi khách xin nhận sớm / trả muộn. Qua đêm trong giới hạn: Home tự báo giá. Phòng ngày hoặc ngoài giới hạn: Home hỏi quản lí trước. Giá luôn do hệ thống đặt phòng tính, Home không tự tính.",
    add: "Thêm ca",
    search: "Tìm ca",
    empty: "Chưa có ca nào. Home sẽ dùng 4 ca qua đêm và phòng ngày mặc định.",
  },
  scenarios: {
    title: "Kịch bản",
    desc: "Mỗi tin khách được xếp vào một kịch bản theo giai đoạn khách và từ khoá; kịch bản quyết định Home đi bước nào, dùng công cụ nào.",
    add: "Thêm kịch bản",
    search: "Tìm kịch bản",
    empty: "Chưa có kịch bản nào. Home sẽ dùng kịch bản mặc định.",
  },
};

export function ListScreen({ ctx, collection }: { ctx: OpsCtx; collection: Extract<CollectionId, "rules" | "templates" | "scenarios" | "stay_shifts"> }) {
  const def = ctx.registry.collections.find((c) => c.id === collection)!;
  const rows = ctx.rows[collection];
  const copy = COPY[collection];
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sel === null && !creating && rows.length && window.matchMedia("(min-width: 1024px)").matches) setSel(rows[0].id);
  }, [rows, sel, creating]);

  const filters: Array<[string, string, number]> = useMemo(() => {
    if (collection === "rules") return [["all", "Tất cả", rows.length], ...(["policy", "convention", "exception"] as const).map((l) => [l, LAYER_LABEL[l], rows.filter((r) => r.data.layer === l).length] as [string, string, number])];
    if (collection === "templates") {
      const sc = [...new Set(rows.map((r) => str(r.data.scenario)).filter(Boolean))];
      return [["all", "Tất cả", rows.length], ...sc.map((s) => [s, str(ctx.rows.scenarios.find((x) => x.id === s)?.data.title) || s, rows.filter((r) => r.data.scenario === s).length] as [string, string, number])];
    }
    return [];
  }, [collection, rows, ctx.rows.scenarios]);

  const shown = rows.filter((r) => {
    if (filter !== "all" && (collection === "rules" ? r.data.layer : r.data.scenario) !== filter) return false;
    if (!q.trim()) return true;
    const hay = fold([r.id, ...Object.values(r.data).flatMap((v) => (Array.isArray(v) ? v.map(String) : [String(v ?? "")]))].join(" "));
    return hay.includes(fold(q.trim()));
  });

  const row = creating ? null : rows.find((r) => r.id === sel) ?? null;
  const close = () => {
    setOpen(false);
    setCreating(false);
  };
  const pick = (id: string) => {
    setCreating(false);
    setSel(id);
    setOpen(true);
  };

  const draft: MdData | undefined = creating
    ? collection === "rules"
      ? { layer: filter !== "all" ? filter : "convention", category: "other", guestVisible: false, appliesTo: [] }
      : collection === "templates"
        ? { lang: "vi", variants: [""], ...(filter !== "all" ? { scenario: filter } : {}) }
        : collection === "stay_shifts"
          ? { bookingType: "overnight", start: "21:00", end: "09:00", approval: "manager", maxEarlyHours: 0, maxLateHours: 0, autoAfterMinutes: 0, autoMaxHours: 0 }
          : { stages: [], tools: [], keywords: [], priority: 100 }
    : undefined;

  const panel =
    creating || row ? (
      <MdForm
        key={creating ? "new" : row!.id}
        def={def}
        row={row}
        draft={draft}
        ctx={ctx.opt}
        canEdit={ctx.canEdit}
        myStaffId={ctx.myStaffId}
        code={creating ? undefined : collection === "templates" ? str(row!.data.key) : row!.id}
        title={creating ? copy.add : str(row!.data[def.titleField]) || row!.id}
        sub={creating ? "Dòng mới — Home dùng sau ~15 giây khi lưu" : subFor(collection, row!)}
        hide={collection === "templates" && row?.isSystem ? ["placeholders"] : []}
        renderTop={collection === "templates" ? (data) => <TemplatePreview data={data} samples={ctx.registry.samples} /> : undefined}
        renderBottom={
          collection === "templates"
            ? (data, set) => <PlaceholderChips data={data} set={set} />
            : collection === "scenarios" && row
              ? () => <ScenarioLinks id={row.id} ctx={ctx} />
              : undefined
        }
        onClose={close}
        onSaved={(saved) => {
          ctx.putRow(collection, saved);
          setCreating(false);
          setSel(saved.id);
        }}
        onDeleted={(id) => {
          ctx.dropRow(collection, id);
          setSel(null);
          close();
        }}
      />
    ) : null;

  const listBody =
    rows.length === 0 ? (
      <EmptyLine>{copy.empty}</EmptyLine>
    ) : shown.length === 0 ? (
      <EmptyLine>
        Không có dòng nào khớp.{" "}
        <button
          type="button"
          className="font-medium text-slate-900 hover:underline"
          onClick={() => {
            setQ("");
            setFilter("all");
          }}
        >
          Xoá lọc
        </button>
      </EmptyLine>
    ) : (
      <div className={`${cls.card} overflow-hidden`}>
        <div className="divide-y divide-slate-100" role="listbox" aria-label={copy.title}>
          {shown.map((r) => (
            <div
              key={r.id}
              role="option"
              tabIndex={0}
              aria-selected={!creating && sel === r.id}
              onClick={() => pick(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(r.id);
                }
              }}
              className={`${cls.row} ${!creating && sel === r.id ? cls.rowSel : ""} ${r.isActive ? "" : "opacity-70"}`}
            >
              <RowBody collection={collection} r={r} ctx={ctx} />
              <Switch checked={r.isActive} onChange={(on) => ctx.toggleRow(collection, r, on)} label={`Bật ${r.id}`} disabled={!ctx.canEdit} />
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <SplitLayout
      open={open}
      onClose={close}
      panel={panel}
      list={
        <>
          <ScreenHead
            title={copy.title}
            desc={copy.desc}
            action={
              ctx.canEdit && def.allowCreate ? (
                <button
                  type="button"
                  className={btn("primary")}
                  onClick={() => {
                    setCreating(true);
                    setOpen(true);
                  }}
                >
                  <Icon name="plus" />
                  {copy.add}
                </button>
              ) : undefined
            }
          />
          {rows.length > 0 && (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {filters.length ? (
                <ScrollRow className="-mx-1 min-w-0 gap-2 px-1">
                  {filters.map(([v, l, n]) => (
                    <FilterChip key={v} active={filter === v} onClick={() => setFilter(v)} count={n}>
                      {l}
                    </FilterChip>
                  ))}
                </ScrollRow>
              ) : (
                <span />
              )}
              <SearchBox value={q} onChange={setQ} placeholder={copy.search} />
            </div>
          )}
          {listBody}
        </>
      }
    />
  );
}

function subFor(c: string, r: MdRow): string {
  const d = r.data as D;
  if (c === "rules") return `${LAYER_LABEL[str(d.layer)] ?? d.layer} · ${CATEGORY_LABEL[str(d.category)] ?? d.category}`;
  if (c === "templates") return r.isSystem ? "Mẫu hệ thống · gửi nguyên văn, không qua AI" : "Mẫu tự tạo";
  if (c === "stay_shifts") return `${d.bookingType === "dayuse" ? "Phòng ngày" : "Qua đêm"} · ${d.approval === "self" ? "Home tự báo giá" : "Hỏi quản lí trước"}`;
  return r.isSystem ? "Kịch bản hệ thống" : "Kịch bản tự tạo";
}

function RowBody({ collection, r, ctx }: { collection: string; r: MdRow; ctx: OpsCtx }) {
  const d = r.data as D;
  if (collection === "rules") {
    const applies = list(d.appliesTo);
    return (
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 w-10 shrink-0 font-mono text-xs font-semibold text-slate-500">{r.id.length <= 5 ? r.id : "•"}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{str(d.title)}</span>
          <span className="mt-0.5 line-clamp-1 text-xs text-slate-500">{str(d.body)}</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
            {CATEGORY_LABEL[str(d.category)] ?? str(d.category)}
            {d.guestVisible === false ? (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <Icon name="eye-off" className="size-3" />
                  Nội bộ
                </span>
              </>
            ) : null}
            <span className="truncate">· {applies.length ? applies.join(", ") : "Mọi kịch bản"}</span>
          </span>
        </span>
      </span>
    );
  }
  if (collection === "templates") {
    const v = list(d.variants);
    return (
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon name="message-square-text" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{str(d.title) || str(d.key)}</span>
          <span className="mt-0.5 line-clamp-1 text-xs text-slate-500">{(v[0] ?? "").replace(/\n/g, " ")}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="font-mono">{str(d.key)}</span>
            <span>· {v.length} biến thể</span>
            {d.lang === "en" ? <span>· English</span> : null}
          </span>
        </span>
      </span>
    );
  }
  if (collection === "stay_shifts") {
    const self = d.approval === "self";
    const early = Number(d.maxEarlyHours ?? 0);
    const late = Number(d.maxLateHours ?? 0);
    const auto = Number(d.autoAfterMinutes ?? 0);
    return (
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon name="clock" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{str(d.label) || r.id}</span>
          <span className="mt-0.5 line-clamp-1 text-xs text-slate-500">
            {self ? `Home tự báo giá: sớm tối đa ${early} giờ, muộn tối đa ${late} giờ` : auto > 0 ? `Hỏi quản lí trước; im lặng ${auto} phút thì Home tự báo giá (mỗi phía ≤ ${Number(d.autoMaxHours ?? 0)} giờ)` : "Luôn hỏi quản lí trước, không tự quyết theo giờ"}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {str(d.start)} → {str(d.end)}
            {d.bookingType === "overnight" ? " (sáng hôm sau)" : ""}
          </span>
        </span>
      </span>
    );
  }
  const stages = list(d.stages);
  void ctx;
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <span className="mt-0.5 w-14 shrink-0 truncate font-mono text-xs font-semibold text-slate-500">{r.id}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{str(d.title)}</span>
        <span className="mt-0.5 line-clamp-1 text-xs text-slate-500">{str(d.goal)}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{stages.length ? stages.map((s) => STAGE_LABEL[s] ?? s).join(" · ") : r.isSystem ? "Nhận diện tự động" : "Mọi giai đoạn"}</span>
      </span>
    </span>
  );
}

function TemplatePreview({ data, samples }: { data: MdData; samples: Record<string, string | number> }) {
  const variants = list(data.variants).filter((x) => x.trim());
  const [i, setI] = useState(0);
  const v = variants.length ? variants[i % variants.length] : "";
  const parts = fillTemplate(v, samples);
  const unknown = parts.filter((p) => p.kind === "unknown").map((p) => p.text);
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cls.lbl}>Khách sẽ thấy</span>
        {variants.length > 1 ? (
          <button type="button" className={btn("ghost", "sm")} onClick={() => setI(i + 1)}>
            <Icon name="shuffle" className="size-3.5" />
            Biến thể {(i % variants.length) + 1}/{variants.length}
          </button>
        ) : null}
      </div>
      <div className="flex items-end gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white" aria-hidden="true">
          H
        </span>
        <div className="max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-6 text-slate-900 shadow-[0_0_0_1px_rgb(15_23_42/.06)]">
          {v ? (
            parts.map((p, k) =>
              p.kind === "plain" ? (
                <React.Fragment key={k}>{p.text}</React.Fragment>
              ) : (
                <span key={k} className={p.kind === "filled" ? "rounded bg-emerald-50 px-0.5 text-emerald-800" : "rounded bg-rose-50 px-0.5 text-rose-700"}>
                  {p.text}
                </span>
              ),
            )
          ) : (
            <span className="text-slate-500">Gõ câu ở ô Biến thể bên dưới.</span>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500 text-pretty">
        {unknown.length ? <span className="text-rose-700">{unknown.join(", ")} không phải chỗ điền của mẫu này — lưu sẽ bị từ chối. </span> : null}
        Chữ tô nền là chỗ hệ thống tự điền (dữ liệu mẫu).
      </p>
    </div>
  );
}

/** Click a placeholder → inserted at the caret of the last focused variant. */
function PlaceholderChips({ data, set }: { data: MdData; set: (k: string, v: unknown) => void }) {
  const ph = list(data.placeholders);
  const last = useRef<{ i: number; pos: number }>({ i: 0, pos: -1 });
  useEffect(() => {
    const track = (e: Event) => {
      const t = e.target as HTMLTextAreaElement;
      if (t?.dataset?.variant != null) last.current = { i: Number(t.dataset.variant), pos: t.selectionStart ?? -1 };
    };
    document.addEventListener("focusout", track);
    return () => document.removeEventListener("focusout", track);
  }, []);
  if (!ph.length) return null;
  return (
    <div className="grid gap-1.5">
      <span className={cls.lbl}>Chỗ điền (bấm để chèn)</span>
      <div className="flex flex-wrap gap-1.5">
        {ph.map((p) => (
          <button
            key={p}
            type="button"
            className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-700 hover:border-slate-400"
            onClick={() => {
              const vs = list(data.variants);
              const { i, pos } = last.current;
              const cur = vs[i] ?? "";
              const at = pos < 0 || pos > cur.length ? cur.length : pos;
              set("variants", vs.length ? vs.map((x, j) => (j === i ? `${cur.slice(0, at)}{${p}}${cur.slice(at)}` : x)) : [`{${p}}`]);
              last.current = { i, pos: at + p.length + 2 };
            }}
          >
            {`{${p}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScenarioLinks({ id, ctx }: { id: string; ctx: OpsCtx }) {
  const tpls = ctx.rows.templates.filter((t) => t.data.scenario === id).length;
  const rules = ctx.rows.rules.filter((r) => r.isActive && (list(r.data.appliesTo).includes(id) || list(r.data.appliesTo).length === 0)).length;
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => ctx.go("mau-tin")} className="rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-100">
        <span className="block text-lg font-bold text-slate-900 tabular-nums">{tpls}</span>
        <span className="text-xs text-slate-600">mẫu tin dùng ở đây</span>
      </button>
      <button type="button" onClick={() => ctx.go("so-luat")} className="rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-100">
        <span className="block text-lg font-bold text-slate-900 tabular-nums">{rules}</span>
        <span className="text-xs text-slate-600">luật Home đọc ở đây</span>
      </button>
    </div>
  );
}
