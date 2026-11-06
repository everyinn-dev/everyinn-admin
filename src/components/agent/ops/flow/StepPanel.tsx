"use client";

/** AI-11 flow editor — right panel: one step (action, its settings, where each outcome goes). Registry-driven. */
import React from "react";
import type { FlowAction, FlowActionParam, FlowStep, MdRow } from "@/lib/agentOps";
import { Dropdown, Field, Icon, PanelHead, Switch, btn, cls } from "../ui";
import { ACTION_ICON, END, LLM, lines, outcomesOf } from "./model";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function StepPanel({
  flow,
  index,
  actions,
  outcomeLabels,
  templates,
  scenarios,
  selfId,
  canEdit,
  onChange,
  onMove,
  onDelete,
  onClose,
}: {
  flow: FlowStep[];
  index: number;
  actions: FlowAction[];
  outcomeLabels: Record<string, string>;
  templates: MdRow[];
  scenarios: MdRow[];
  selfId: string | null;
  canEdit: boolean;
  onChange: (s: FlowStep) => void;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const step = flow[index];
  const action = actions.find((a) => a.id === step.action);
  const setParam = (k: string, v: unknown) => onChange({ ...step, params: { ...(step.params ?? {}), [k]: v } });
  const setNext = (outcome: string, target: string) => {
    const next = { ...(step.next ?? {}) };
    if (target === "__default") delete next[outcome];
    else next[outcome] = target;
    onChange({ ...step, next: Object.keys(next).length ? next : undefined });
  };
  const tplOptions: Array<[string, string]> = [...new Map(templates.filter((t) => t.data.lang !== "en").map((t) => [str(t.data.key), `${str(t.data.title) || str(t.data.key)}`])).entries()].filter(([k]) => k);
  const scenarioOptions: Array<[string, string]> = scenarios.filter((s) => s.id !== selfId).map((s) => [s.id, str(s.data.title) || s.id]);
  const outs = outcomesOf(step, action, outcomeLabels);
  const following = flow[index + 1];
  const targetOptions = (): Array<[string, string]> => [
    ["__default", following && !["end", "goto_scenario", "ask_llm"].includes(step.action) ? `Bước tiếp theo (${index + 2}. ${following.title || following.id})` : "Mặc định (kết thúc)"],
    ...flow.filter((s) => s.id !== step.id).map((s) => [s.id, `${flow.indexOf(s) + 1}. ${s.title || s.id}`] as [string, string]),
    [END, "Kết thúc"],
    [LLM, "Home tự trả lời (AI)"],
    ...scenarioOptions.map(([id, t]) => [`scenario:${id}`, `Sang kịch bản “${t}”`] as [string, string]),
  ];

  const control = (p: FlowActionParam) => {
    const v = step.params?.[p.name];
    switch (p.type) {
      case "template": {
        const t = templates.find((x) => str(x.data.key) === str(v) && x.data.lang !== "en");
        const preview = t && Array.isArray(t.data.variants) ? String(t.data.variants[0] ?? "") : "";
        return (
          <div className="grid gap-2">
            <Dropdown options={tplOptions} value={str(v) || undefined} onChange={(x) => setParam(p.name, x)} disabled={!canEdit} placeholder="Chọn mẫu tin" label={p.label} />
            {preview ? <p className="whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">{preview}</p> : null}
          </div>
        );
      }
      case "scenario":
        return <Dropdown options={scenarioOptions} value={str(v) || undefined} onChange={(x) => setParam(p.name, x)} disabled={!canEdit} placeholder="Chọn kịch bản" label={p.label} />;
      case "boolean":
        return (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-700">{v ? "Có" : "Không"}</span>
            <Switch checked={!!v} onChange={(x) => setParam(p.name, x)} label={p.label} disabled={!canEdit} />
          </div>
        );
      case "number":
        return <input type="number" className={`${cls.fld} ${cls.input}`} value={v == null ? "" : String(v)} disabled={!canEdit} onChange={(e) => setParam(p.name, e.target.value === "" ? undefined : Number(e.target.value))} />;
      case "lines":
        return (
          <textarea
            className={`${cls.fld} ${cls.area}`}
            rows={3}
            disabled={!canEdit}
            value={lines(v).join("\n") + (Array.isArray(v) && String(v.at(-1) ?? "") === "" && v.length ? "\n" : "")}
            onChange={(e) => setParam(p.name, e.target.value.split("\n"))}
            onBlur={(e) => setParam(p.name, lines(e.target.value))}
          />
        );
      case "text":
        return <textarea className={`${cls.fld} ${cls.area}`} rows={3} disabled={!canEdit} value={str(v)} onChange={(e) => setParam(p.name, e.target.value)} />;
      default:
        return <input className={`${cls.fld} ${cls.input}`} disabled={!canEdit} value={str(v)} onChange={(e) => setParam(p.name, e.target.value)} />;
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <PanelHead code={`Bước ${index + 1}`} title={step.title || action?.label || "Bước"} sub={action ? action.label : "Chưa chọn hành động"} onBack={onClose} />
      <div className="grid flex-1 content-start gap-5 px-5 py-5">
        <Field label="Tên bước (bạn đặt)">
          <input className={`${cls.fld} ${cls.input}`} maxLength={80} disabled={!canEdit} value={step.title ?? ""} placeholder={action?.label} onChange={(e) => onChange({ ...step, title: e.target.value })} />
        </Field>
        <Field label="Hành động" help={action?.help} as="div">
          <Dropdown
            options={actions.map((a) => [a.id, a.label])}
            value={step.action}
            onChange={(id) => onChange({ ...step, action: id, params: {}, next: undefined })}
            disabled={!canEdit}
            label="Hành động"
          />
        </Field>
        {action?.waits ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <Icon name="hourglass" className="mt-0.5 size-3.5 shrink-0" />
            Bước này dừng lại chờ {step.action === "ask_guest" ? "khách trả lời" : step.action === "notify_owner" ? (step.params?.wait ? "quản lí trả lời" : "— chỉ khi bật “Chờ quản lí trả lời”") : "khách và quản lí trả lời"}. Quản lí chưa trả lời sau 10 phút thì Home nhắc một lần.
          </p>
        ) : null}
        {action?.params.map((p) => (
          <Field key={p.name} label={`${p.label}${p.required ? " *" : ""}`} as="div">
            {control(p)}
          </Field>
        ))}
        {outs.length > 0 ? (
          <div className="grid gap-3">
            <div>
              <span className={cls.lbl}>Sau bước này</span>
              <p className={cls.help}>Mỗi kết quả đi tiếp đâu. Để mặc định thì sang bước kế tiếp.</p>
            </div>
            {outs.map((o) => {
              const explicit = step.next?.[o.key];
              return (
                <div key={o.key} className="grid gap-1.5 rounded-xl border border-slate-200 p-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Icon name="corner-down-right" className="size-3.5 text-slate-500" />
                    {o.label}
                  </span>
                  <Dropdown options={targetOptions()} value={explicit ?? "__default"} onChange={(t) => setNext(o.key, t)} disabled={!canEdit} label={`Khi ${o.label}`} />
                  {!explicit && step.next?.["*"] ? <span className={cls.help}>Đang theo nhánh “còn lại”.</span> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      {canEdit ? (
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" className={btn("ghost", "icon")} onClick={() => onMove(-1)} disabled={index === 0} aria-label="Đưa bước lên" title="Đưa bước lên">
            <Icon name="arrow-up" />
          </button>
          <button type="button" className={btn("ghost", "icon")} onClick={() => onMove(1)} disabled={index === flow.length - 1} aria-label="Đưa bước xuống" title="Đưa bước xuống">
            <Icon name="arrow-down" />
          </button>
          <button type="button" className={`${btn("ghost", "sm")} ml-auto text-rose-700 hover:bg-rose-50 hover:text-rose-800`} onClick={onDelete}>
            <Icon name="trash-2" className="size-3.5" />
            Xoá bước
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { ACTION_ICON };
