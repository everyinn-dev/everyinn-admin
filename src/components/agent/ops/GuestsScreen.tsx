"use client";

/** Chân dung khách: guests by segment (tags + note editable) and the segment definitions (master data). */
import React, { useEffect, useMemo, useState } from "react";
import { AgentApiError } from "@/lib/agentApi";
import { fmtVn, opsApi, type GuestProfile } from "@/lib/agentOps";
import { useToast } from "@/components/ui/Toast";
import { EmptyLine, ErrorBlock, Field, FilterChip, Icon, PanelFooter, PanelHead, ScreenHead, ScrollRow, SearchBox, SkeletonRows, Switch, Tag, btn, cls } from "./ui";
import { MdForm } from "./MdForm";
import { SplitLayout, type OpsCtx } from "./AgentOps";

const vnd = (n?: number) => (n ? `${n.toLocaleString("vi-VN")} đ` : "0 đ");
const day = (iso?: string | null) => (iso ? fmtVn(iso).slice(0, 5) : "—");

export function GuestsScreen({ ctx }: { ctx: OpsCtx }) {
  const [view, setView] = useState<"khach" | "nhom">("khach");
  const [seg, setSeg] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [selSeg, setSelSeg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(false);
  const guests = ctx.guests;
  const segRows = ctx.rows.segments;
  const segDef = ctx.registry.collections.find((c) => c.id === "segments")!;
  const segLabel = (id: string | null) => {
    const s = segRows.find((x) => x.id === id);
    return s ? `${s.data.emoji ? `${String(s.data.emoji)} ` : ""}${String(s.data.label ?? id)}` : "Chưa xếp nhóm";
  };

  const reload = () => {
    setErr(false);
    ctx.setGuests(null);
    opsApi.guests().then(ctx.setGuests).catch(() => setErr(true));
  };
  useEffect(() => {
    if (guests === null) opsApi.guests().then(ctx.setGuests).catch(() => setErr(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of guests ?? []) m[g.segment ?? ""] = (m[g.segment ?? ""] ?? 0) + 1;
    return m;
  }, [guests]);
  const shown = (guests ?? []).filter((g) => (seg === "all" || g.segment === seg) && (!q.trim() || (g.name ?? "").toLowerCase().includes(q.trim().toLowerCase()) || (g.phoneMasked ?? "").includes(q.trim().replace(/^0/, ""))));

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    if (view === "khach" && sel === null && shown.length) setSel(shown[0].id);
    if (view === "nhom" && selSeg === null && !creating && segRows.length) setSelSeg(segRows[0].id);
  }, [view, sel, selSeg, shown, segRows, creating]);

  const close = () => {
    setOpen(false);
    setCreating(false);
  };
  const guest = (guests ?? []).find((g) => g.id === sel) ?? null;
  const segRow = creating ? null : segRows.find((s) => s.id === selSeg) ?? null;

  const panel =
    view === "khach" ? (
      guest ? (
        <GuestPanel
          key={guest.id + guest.version}
          g={guest}
          segLabel={segLabel(guest.segment)}
          canEdit={ctx.canEdit}
          onClose={close}
          onSaved={(g) => ctx.setGuests((guests ?? []).map((x) => (x.id === g.id ? g : x)))}
        />
      ) : null
    ) : creating || segRow ? (
      <MdForm
        key={creating ? "new" : segRow!.id}
        def={segDef}
        row={segRow}
        draft={creating ? { priority: 60, stages: [], tiers: [], tagsAny: [] } : undefined}
        ctx={ctx.opt}
        canEdit={ctx.canEdit}
        myStaffId={ctx.myStaffId}
        code={creating ? undefined : segRow!.id}
        title={creating ? "Thêm nhóm khách" : segLabel(segRow!.id)}
        sub={creating ? "Nhóm mới — dùng được ngay trong Bảng quyền" : `Độ ưu tiên ${String(segRow!.data.priority ?? 0)}`}
        onClose={close}
        onSaved={(saved) => {
          ctx.putRow("segments", saved);
          setCreating(false);
          setSelSeg(saved.id);
        }}
        onDeleted={(id) => {
          ctx.dropRow("segments", id);
          setSelSeg(null);
          close();
        }}
      />
    ) : null;

  return (
    <SplitLayout
      open={open}
      onClose={close}
      panel={panel}
      list={
        <>
          <ScreenHead
            title="Chân dung khách"
            desc="Mỗi khách được xếp vào một nhóm từ số lần ở, no-show, hạng thành viên và nhãn bạn gắn. Nhóm quyết định Home được tự quyết tới đâu trong Bảng quyền."
            action={
              view === "nhom" && ctx.canEdit ? (
                <button
                  type="button"
                  className={btn("primary")}
                  onClick={() => {
                    setCreating(true);
                    setOpen(true);
                  }}
                >
                  <Icon name="plus" />
                  Thêm nhóm
                </button>
              ) : undefined
            }
          />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="group" className="inline-flex shrink-0 gap-1 self-start rounded-xl bg-slate-100 p-1">
              {(
                [
                  ["khach", "Khách"],
                  ["nhom", "Định nghĩa nhóm"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => {
                    setView(v);
                    setCreating(false);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-lg px-3 text-xs ${view === v ? "bg-white font-semibold text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/.08),0_0_0_1px_rgb(15_23_42/.05)]" : "font-medium text-slate-600 hover:text-slate-900"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {view === "khach" && guests && guests.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
                <ScrollRow className="-mx-1 min-w-0 gap-2 px-1">
                  <FilterChip active={seg === "all"} onClick={() => setSeg("all")} count={guests.length}>
                    Tất cả
                  </FilterChip>
                  {segRows
                    .filter((s) => counts[s.id])
                    .map((s) => (
                      <FilterChip key={s.id} active={seg === s.id} onClick={() => setSeg(s.id)} count={counts[s.id]}>
                        {segLabel(s.id)}
                      </FilterChip>
                    ))}
                </ScrollRow>
                <SearchBox value={q} onChange={setQ} placeholder="Tên hoặc SĐT" />
              </div>
            ) : null}
          </div>
          {view === "nhom" ? (
            <div className={`${cls.card} overflow-hidden`}>
              <div className="divide-y divide-slate-100" role="listbox" aria-label="Nhóm khách">
                {segRows.map((s) => (
                  <div
                    key={s.id}
                    role="option"
                    tabIndex={0}
                    aria-selected={!creating && selSeg === s.id}
                    onClick={() => {
                      setCreating(false);
                      setSelSeg(s.id);
                      setOpen(true);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (setSelSeg(s.id), setOpen(true))}
                    className={`${cls.row} items-center ${!creating && selSeg === s.id ? cls.rowSel : ""} ${s.isActive ? "" : "opacity-70"}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-base">{String(s.data.emoji ?? "")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{String(s.data.label ?? s.id)}</span>
                      <span className="line-clamp-1 text-xs text-slate-500">{String(s.data.description ?? "")}</span>
                    </span>
                    <span className="w-16 shrink-0 text-right text-sm tabular-nums text-slate-900">
                      {counts[s.id] ?? 0}
                      <span className="block text-xs text-slate-500">khách</span>
                    </span>
                    <Switch checked={s.isActive} onChange={(on) => ctx.toggleRow("segments", s, on)} label={`Bật nhóm ${String(s.data.label ?? s.id)}`} disabled={!ctx.canEdit} />
                  </div>
                ))}
              </div>
            </div>
          ) : err ? (
            <ErrorBlock what="hồ sơ khách" onRetry={reload} />
          ) : guests === null ? (
            <SkeletonRows n={6} />
          ) : guests.length === 0 ? (
            <EmptyLine>Chưa có hồ sơ khách. Hồ sơ tự tạo khi khách nhắn tin cho Home.</EmptyLine>
          ) : shown.length === 0 ? (
            <EmptyLine>
              Không có khách nào khớp.{" "}
              <button
                type="button"
                className="font-medium text-slate-900 hover:underline"
                onClick={() => {
                  setQ("");
                  setSeg("all");
                }}
              >
                Xoá lọc
              </button>
            </EmptyLine>
          ) : (
            <div className={`${cls.card} overflow-hidden`}>
              <div className="divide-y divide-slate-100" role="listbox" aria-label="Khách">
                {shown.map((g) => (
                  <div
                    key={g.id}
                    role="option"
                    tabIndex={0}
                    aria-selected={sel === g.id}
                    onClick={() => {
                      setSel(g.id);
                      setOpen(true);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (setSel(g.id), setOpen(true))}
                    className={`${cls.row} items-center ${sel === g.id ? cls.rowSel : ""}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{initials(g.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{g.name || "Khách chưa rõ tên"}</span>
                      <span className="block truncate text-xs text-slate-500 tabular-nums">
                        {g.phoneMasked ?? "chưa có SĐT"} · cập nhật {day(g.updatedAt)}
                      </span>
                    </span>
                    <span className="hidden w-28 shrink-0 sm:block">
                      <Tag tone={g.segment === "watch" ? "warn" : g.segment === "vip" || g.segment === "regular" ? "brand" : "slate"}>{segLabel(g.segment)}</Tag>
                    </span>
                    <span className="w-14 shrink-0 text-right text-sm tabular-nums text-slate-900">
                      {g.stats?.stays ?? 0}
                      <span className="block text-xs text-slate-500">lần ở</span>
                    </span>
                    <span className="hidden w-28 shrink-0 text-right text-sm tabular-nums text-slate-900 lg:block">
                      {vnd(g.stats?.spend)}
                      <span className="block text-xs text-slate-500">tổng chi</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      }
    />
  );
}

const initials = (n: string | null) =>
  (n ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(-2)
    .join("")
    .toUpperCase() || "?";

function GuestPanel({ g, segLabel, canEdit, onClose, onSaved }: { g: GuestProfile; segLabel: string; canEdit: boolean; onClose: () => void; onSaved: (g: GuestProfile) => void }) {
  const toast = useToast();
  const [tags, setTags] = useState(g.tags);
  const [note, setNote] = useState(g.note ?? "");
  const [tagText, setTagText] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(tags) !== JSON.stringify(g.tags) || note !== (g.note ?? "");
  const addTag = (t: string) => {
    const v = t.trim().slice(0, 30);
    if (v && !tags.includes(v) && tags.length < 10) setTags([...tags, v]);
    setTagText("");
  };
  const save = async () => {
    setSaving(true);
    try {
      const saved = await opsApi.updateGuest(g.id, { tags, note: note.trim() ? note.trim() : null, expectedVersion: g.version });
      toast.success("Đã lưu. Nhóm khách tính lại từ tin nhắn sau.");
      onSaved(saved);
    } catch (e) {
      if (e instanceof AgentApiError && e.status === 409) toast.warning("Hồ sơ vừa được cập nhật — tải lại rồi sửa tiếp.");
      else toast.error(e instanceof AgentApiError ? e.message : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  };
  const st: Array<[string, string]> = [
    ["Số lần ở", String(g.stats?.stays ?? 0)],
    ["No-show / huỷ", String((g.stats?.noShows ?? 0) + (g.stats?.cancels ?? 0))],
    ["Tổng chi", vnd(g.stats?.spend)],
    ["Hạng", g.stats?.tier ? g.stats.tier[0].toUpperCase() + g.stats.tier.slice(1) : "—"],
    ["Lần cuối", day(g.stats?.lastStayAt)],
    ["Nhóm", segLabel],
  ];
  return (
    <div className="flex min-h-full flex-col">
      <PanelHead code={g.phoneMasked ?? undefined} title={g.name || "Khách chưa rõ tên"} sub="Nhóm tự tính từ lịch sử + nhãn" onBack={onClose} />
      <div className="grid flex-1 content-start gap-4 px-5 py-4">
        <dl className="grid grid-cols-3 gap-2">
          {st.map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="truncate text-sm font-semibold text-slate-900 tabular-nums" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <Field label="Nhãn" as="div" help="Nhãn VIP / Cần lưu ý đổi nhóm khách ngay từ tin nhắn sau.">
          <div className={`${cls.fld} flex min-h-10 flex-wrap items-center gap-1.5 py-1.5`}>
            {tags.map((t) => (
              <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-slate-100 pl-2.5 pr-1 text-xs font-medium text-slate-800">
                {t}
                {canEdit ? (
                  <button type="button" className="grid size-5 place-items-center rounded-full hover:bg-slate-200" aria-label={`Bỏ nhãn ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                    <Icon name="x" className="size-3" />
                  </button>
                ) : null}
              </span>
            ))}
            {canEdit ? (
              <input
                className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                placeholder="Thêm nhãn: VIP, Cần lưu ý…"
                value={tagText}
                onChange={(e) => setTagText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagText);
                  } else if (e.key === "Backspace" && !tagText && tags.length) setTags(tags.slice(0, -1));
                }}
                onBlur={() => tagText && addTag(tagText)}
              />
            ) : null}
          </div>
        </Field>
        {canEdit ? (
          <div className="flex flex-wrap gap-1.5">
            {["VIP", "Cần lưu ý"].filter((t) => !tags.includes(t)).map((t) => (
              <button key={t} type="button" className={btn("outline", "sm")} onClick={() => addTag(t)}>
                <Icon name="plus" className="size-3.5" />
                {t}
              </button>
            ))}
          </div>
        ) : null}
        <Field label="Ghi chú cho Home">
          <textarea className={`${cls.fld} ${cls.area}`} rows={3} maxLength={500} placeholder="vd: thích phòng yên tĩnh" value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <PanelFooter
        by=""
        line={`Cập nhật lần cuối ${day(g.updatedAt)}`}
        note="Home thấy nhãn và ghi chú ở tin nhắn sau."
        dirty={dirty}
        saving={saving}
        canEdit={canEdit}
        onCancel={() => {
          setTags(g.tags);
          setNote(g.note ?? "");
        }}
        onSave={save}
      />
    </div>
  );
}
