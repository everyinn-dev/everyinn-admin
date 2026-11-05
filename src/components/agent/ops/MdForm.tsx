"use client";

/**
 * Registry-driven editor: renders any master-data row from its collection's field defs (GET /md/_registry).
 * A new field in agent-core's registry shows up here without an admin change.
 */
import React, { useEffect, useMemo, useState } from "react";
import { AgentApiError } from "@/lib/agentApi";
import { CATEGORY_LABEL, DAY_LABEL, DECIDER_LABEL, LAYER_LABEL, STAGE_LABEL, TIER_LABEL, editorLabel, fmtVn, opsApi, type Capability, type MdCollection, type MdData, type MdField, type MdRow } from "@/lib/agentOps";
import { useToast } from "@/components/ui/Toast";
import { Chips, Dropdown, Field, Icon, PanelFooter, PanelHead, Seg, Switch, cls } from "./ui";

export interface OptionCtx {
  scenarios: MdRow[];
  segments: MdRow[];
  capabilities: Capability[];
}

/** Human label of an option value for a field. */
export function optionLabel(f: MdField, v: string, ctx: OptionCtx): string {
  switch (f.source) {
    case "layers":
      return LAYER_LABEL[v] ?? v;
    case "categories":
      return CATEGORY_LABEL[v] ?? v;
    case "stages":
      return STAGE_LABEL[v] ?? v;
    case "deciders":
      return DECIDER_LABEL[v as keyof typeof DECIDER_LABEL] ?? v;
    case "capabilities":
      return ctx.capabilities.find((c) => c.id === v)?.label ?? v;
    case "segments": {
      if (v === "any") return "Mọi khách";
      const s = ctx.segments.find((x) => x.id === v)?.data as { label?: string; emoji?: string } | undefined;
      return s ? `${s.emoji ? `${s.emoji} ` : ""}${s.label ?? v}` : v;
    }
    case "scenarios": {
      const s = ctx.scenarios.find((x) => x.id === v)?.data as { title?: string } | undefined;
      return s?.title ? `${v} · ${s.title}` : v;
    }
  }
  if (f.name === "days") return DAY_LABEL[v] ?? v;
  if (f.name === "tiers") return TIER_LABEL[v] ?? v;
  if (f.name === "lang") return v === "vi" ? "Tiếng Việt" : v === "en" ? "English" : v;
  return v;
}

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : []);

// datetime fields are ISO in the API; the editor types dd/mm/yyyy [HH:mm] in VN time (UTC+7)
function isoToVn(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
function vnToIso(s: string): string | null | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(t);
  if (!m) return null;
  const [, dd, mm, yy, hh = "23", mi = "59"] = m;
  return new Date(Date.UTC(+yy, +mm - 1, +dd, +hh - 7, +mi)).toISOString();
}

export interface MdFormProps {
  def: MdCollection;
  row: MdRow | null;
  /** Prefill for a new row. */
  draft?: MdData;
  ctx: OptionCtx;
  canEdit: boolean;
  myStaffId?: number | null;
  title: string;
  code?: string;
  sub?: string;
  /** Content above the fields (e.g. template preview); gets the live form data. */
  renderTop?: (data: MdData, set: (k: string, v: unknown) => void) => React.ReactNode;
  /** Content below the fields. */
  renderBottom?: (data: MdData, set: (k: string, v: unknown) => void) => React.ReactNode;
  hide?: string[];
  onClose: () => void;
  onSaved: (row: MdRow) => void;
  onDeleted?: (id: string) => void;
}

export function MdForm({ def, row, draft, ctx, canEdit, myStaffId, title, code, sub, renderTop, renderBottom, hide = [], onClose, onSaved, onDeleted }: MdFormProps) {
  const toast = useToast();
  const initial = useMemo(() => ({ ...(row?.data ?? draft ?? {}) }), [row, draft]);
  const [data, setData] = useState<MdData>(initial);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setData(initial);
    setDates(Object.fromEntries(def.fields.filter((f) => f.type === "datetime").map((f) => [f.name, isoToVn(initial[f.name])])));
    setConfirmDelete(false);
  }, [initial, def]);

  const dirty = !row || JSON.stringify(data) !== JSON.stringify(initial) || def.fields.some((f) => f.type === "datetime" && dates[f.name] !== isoToVn(initial[f.name]));
  const locked = (f: MdField) => !canEdit || (!!row?.isSystem && !!def.systemLocked?.includes(f.name));
  const set = (k: string, v: unknown) => setData((d) => {
    const n = { ...d };
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0 && !def.fields.find((f) => f.name === k)?.required)) delete n[k];
    else n[k] = v;
    return n;
  });

  // authority: deciders + limit fields follow the chosen capability
  const cap = def.id === "authority" ? ctx.capabilities.find((c) => c.id === data.capability) : undefined;
  const visible = (f: MdField) => {
    if (hide.includes(f.name)) return false;
    if (def.id === "authority" && ["maxHours", "maxPercent", "maxAmount"].includes(f.name)) return !!cap?.limits.includes(f.name as "maxHours");
    return true;
  };
  const optionsOf = (f: MdField): string[] => {
    const o = f.options ?? [];
    if (def.id === "authority" && f.name === "decider" && cap) return o.filter((d) => cap.deciders.includes(d as never));
    return o;
  };

  const save = async () => {
    const out: MdData = { ...data };
    for (const f of def.fields.filter((x) => x.type === "datetime")) {
      const iso = vnToIso(dates[f.name] ?? "");
      if (iso === null) return toast.error(`${f.label}: nhập theo dạng dd/mm/yyyy hoặc dd/mm/yyyy HH:mm.`);
      if (iso === undefined) delete out[f.name];
      else out[f.name] = iso;
    }
    for (const f of def.fields) if (f.required && visible(f) && (out[f.name] === undefined || out[f.name] === "")) return toast.error(`Thiếu “${f.label}”.`);
    setSaving(true);
    try {
      const saved = row ? await opsApi.update(def.id, row.id, { data: out, expectedVersion: row.version }) : await opsApi.create(def.id, { data: out, isActive: true });
      toast.success(row ? "Đã lưu. Home dùng bản mới sau ~15 giây." : "Đã thêm. Home dùng ngay sau ~15 giây.");
      onSaved(saved);
    } catch (e) {
      if (e instanceof AgentApiError && e.status === 409) toast.warning("Dòng này vừa được sửa ở nơi khác — đã tải lại, bạn sửa tiếp nhé.");
      else toast.error(e instanceof AgentApiError ? e.message : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!row) return;
    setSaving(true);
    try {
      await opsApi.remove(def.id, row.id);
      toast.success("Đã xoá.");
      onDeleted?.(row.id);
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Không xoá được.");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const control = (f: MdField): React.ReactNode => {
    const v = data[f.name];
    const dis = locked(f);
    switch (f.type) {
      case "string":
        return dis && row?.isSystem && def.systemLocked?.includes(f.name) ? (
          <div className={`${cls.fld} ${cls.input} flex items-center gap-2 bg-slate-50 font-mono text-slate-600`}>
            <Icon name="lock" className="size-3.5" />
            <span className="truncate">{String(v ?? "")}</span>
          </div>
        ) : (
          <input className={`${cls.fld} ${cls.input}`} value={String(v ?? "")} maxLength={f.max} disabled={dis} onChange={(e) => set(f.name, e.target.value)} />
        );
      case "text":
        return <textarea className={`${cls.fld} ${cls.area}`} rows={f.max && f.max > 400 ? 5 : 3} maxLength={f.max} value={String(v ?? "")} disabled={dis} onChange={(e) => set(f.name, e.target.value)} />;
      case "number":
        return (
          <input
            className={`${cls.fld} ${cls.input} w-32 tabular-nums`}
            inputMode="numeric"
            disabled={dis}
            value={v === undefined || v === null ? "" : String(v)}
            onChange={(e) => {
              const t = e.target.value.replace(/[^\d]/g, "");
              set(f.name, t === "" ? undefined : Math.min(f.max ?? Infinity, Number(t)));
            }}
          />
        );
      case "boolean":
        return (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{f.label}</span>
              {f.help ? <span className={cls.help}>{f.help}</span> : null}
            </span>
            <Switch checked={v !== false} onChange={(x) => set(f.name, x)} label={f.label} disabled={dis} />
          </div>
        );
      case "enum": {
        const opts = optionsOf(f).map((o) => [o, optionLabel(f, o, ctx)] as [string, string]);
        return opts.length <= 4 && opts.every(([, l]) => l.length <= 16) ? (
          <Seg options={opts} value={v as string | undefined} onChange={(x) => set(f.name, x)} disabled={dis} label={f.label} />
        ) : (
          <Dropdown options={opts} value={v as string | undefined} onChange={(x) => set(f.name, x)} disabled={dis} label={f.label} />
        );
      }
      case "multi": {
        const opts = optionsOf(f).map((o) => [o, f.source === "scenarios" ? o : optionLabel(f, o, ctx)] as [string, string]);
        if (f.source === "tools")
          return (
            <Chips options={opts.map(([o]) => [o, o])} value={asList(v)} onChange={(x) => set(f.name, x)} disabled={dis} />
          );
        return <Chips options={opts} value={asList(v)} onChange={(x) => set(f.name, x)} disabled={dis} />;
      }
      case "lines": {
        const list = asList(v);
        if (f.name === "variants") {
          const items = list.length ? list : [""];
          return (
            <div className="grid gap-3">
              {items.map((t, i) => (
                <div key={i} className="grid gap-1.5">
                  <span className="flex items-center justify-between text-xs text-slate-500">
                    Biến thể {i + 1}
                    {items.length > 1 && !dis ? (
                      <button type="button" className="text-xs font-medium text-slate-600 hover:text-rose-700" onClick={() => set(f.name, items.filter((_, j) => j !== i))}>
                        Bỏ
                      </button>
                    ) : null}
                  </span>
                  <textarea
                    className={`${cls.fld} ${cls.area}`}
                    rows={Math.min(8, t.split("\n").length + 2)}
                    value={t}
                    disabled={dis}
                    data-variant={i}
                    onChange={(e) => set(f.name, items.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                </div>
              ))}
              {!dis && items.length < (f.max ?? 5) ? (
                <button type="button" className={`${cls.btn} ${cls.sm} ${cls.outline} justify-self-start`} onClick={() => set(f.name, [...items, ""])}>
                  <Icon name="plus" className="size-3.5" />
                  Thêm biến thể
                </button>
              ) : null}
            </div>
          );
        }
        return (
          <textarea
            className={`${cls.fld} ${cls.area}`}
            rows={Math.max(2, Math.min(8, list.length + 1))}
            disabled={dis}
            value={list.join("\n")}
            onChange={(e) => set(f.name, e.target.value.split("\n").map((x) => x.replace(/^\s+/, "")).filter((x, i, a) => x || i === a.length - 1))}
            onBlur={(e) => set(f.name, e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
          />
        );
      }
      case "time":
        return <input className={`${cls.fld} ${cls.input} tabular-nums`} inputMode="numeric" placeholder="HH:MM" maxLength={5} disabled={dis} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value.replace(/[^\d:]/g, ""))} />;
      case "datetime":
        return <input className={`${cls.fld} ${cls.input} tabular-nums`} placeholder="dd/mm/yyyy, trống = không hết hạn" disabled={dis} value={dates[f.name] ?? ""} onChange={(e) => setDates((d) => ({ ...d, [f.name]: e.target.value }))} />;
    }
  };

  const fields = def.fields.filter(visible);
  // pair short fields (time / time) side by side
  const blocks: MdField[][] = [];
  for (const f of fields) {
    const prev = blocks[blocks.length - 1];
    if (f.type === "time" && prev?.length === 1 && prev[0].type === "time") prev.push(f);
    else blocks.push([f]);
  }

  return (
    <div className="flex min-h-full flex-col">
      <PanelHead code={code} title={title} sub={sub} onBack={onClose} />
      <div className="grid flex-1 content-start gap-4 px-5 py-4">
        {renderTop?.(data, set)}
        {blocks.map((b) =>
          b.length === 2 ? (
            <div key={b[0].name} className="grid grid-cols-2 gap-3">
              {b.map((f) => (
                <Field key={f.name} label={f.label}>
                  {control(f)}
                </Field>
              ))}
            </div>
          ) : b[0].type === "boolean" ? (
            <React.Fragment key={b[0].name}>{control(b[0])}</React.Fragment>
          ) : (
            <Field
              key={b[0].name}
              label={b[0].label}
              as={b[0].type === "multi" || b[0].type === "enum" || (b[0].type === "lines" && b[0].name === "variants") ? "div" : "label"}
              help={
                b[0].type === "text" && b[0].max ? (
                  <>
                    <span className="tabular-nums">{String(data[b[0].name] ?? "").length}</span>/{b[0].max} ký tự{b[0].help ? ` · ${b[0].help}` : ""}
                  </>
                ) : def.id === "authority" && b[0].name === "decider" && cap ? (
                  cap.help
                ) : (
                  b[0].help
                )
              }
            >
              {control(b[0])}
            </Field>
          ),
        )}
        {renderBottom?.(data, set)}
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
            <span className="min-w-0 flex-1 text-sm text-rose-800">Xoá hẳn dòng này? Home sẽ không dùng nữa.</span>
            <button type="button" className={`${cls.btn} ${cls.sm} ${cls.ghost}`} onClick={() => setConfirmDelete(false)}>
              Giữ lại
            </button>
            <button type="button" className={`${cls.btn} ${cls.sm} bg-rose-700 font-semibold text-white hover:bg-rose-800`} onClick={remove} disabled={saving}>
              Xoá
            </button>
          </div>
        ) : null}
      </div>
      <PanelFooter
        by={row ? `${editorLabel(row.updatedBy, myStaffId)} · ${fmtVn(row.updatedAt)}` : "—"}
        note={row?.isSystem ? "Dòng hệ thống: tắt được, không xoá được." : "Home dùng bản mới sau ~15 giây."}
        dirty={dirty}
        saving={saving}
        canEdit={canEdit}
        onCancel={() => {
          setData(initial);
          if (!row) onClose();
        }}
        onSave={save}
        onDelete={row && !row.isSystem ? () => setConfirmDelete(true) : undefined}
      />
    </div>
  );
}
