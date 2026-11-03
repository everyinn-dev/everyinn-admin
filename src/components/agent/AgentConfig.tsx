"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { agentApi, AgentApiError, formatVnTime, ROOMS, type AgentSettings } from "@/lib/agentApi";
import { useToast } from "@/components/ui/Toast";
import { BusyToggle } from "./BusyToggle";

type Tab = "persona" | "codes" | "knowledge" | "faq" | "tools";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "persona", label: "🧑‍💼 Tính cách & Giờ bận" },
  { key: "codes", label: "🔑 Mã cửa" },
  { key: "knowledge", label: "📚 Kiến thức" },
  { key: "faq", label: "❓ FAQ" },
  { key: "tools", label: "🧰 Công cụ & Telegram" },
];

/** Candidate models for HITL-2 evaluation (OD-2). Any Workers AI id can be typed in. */
const MODEL_OPTIONS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
];

const TOOL_LABELS: Record<string, string> = {
  check_availability: "Kiểm tra phòng trống",
  get_price_quote: "Báo giá (Booking Core)",
  create_booking_hold: "Giữ phòng + gửi VietQR",
  get_booking: "Tra cứu đơn của khách",
  update_booking: "Sửa đơn (tắt — chuyển quản lý)",
  get_checkin_guide: "Hướng dẫn nhận phòng",
  ask_owner: "Chuyển quản lý",
  report_issue: "Báo sự cố khẩn",
};

const card = "p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3";
const input = "w-full px-3 py-2 rounded-lg border border-slate-300 text-base sm:text-sm bg-white";
const label = "text-[11px] font-bold text-slate-500 uppercase tracking-wider";
const btn = "px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50";

function useErr() {
  const toast = useToast();
  return (e: unknown, fallback: string) => toast.error(e instanceof AgentApiError ? e.message : fallback);
}

// ── Tab 1: persona, model, rules, quiet hours ───────────────────────────────────────────────
function PersonaTab({ settings, onSaved }: { settings: AgentSettings; onSaved: (s: AgentSettings) => void }) {
  const toast = useToast();
  const err = useErr();
  const [f, setF] = useState(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setF(settings), [settings]);
  const num = (k: keyof AgentSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });

  const save = async () => {
    setSaving(true);
    try {
      const res = await agentApi<{ settings: AgentSettings }>("settings", {
        method: "PUT",
        body: {
          expectedVersion: settings.version,
          botName: f.botName,
          personaPrompt: f.personaPrompt,
          modelId: f.modelId,
          supervisedMode: f.supervisedMode,
          quietHours: f.quietHours,
          busyAutoReplyTemplate: f.busyAutoReplyTemplate,
          checkinMessageTemplate: f.checkinMessageTemplate,
          hotline: f.hotline,
          maxDiscountPercent: f.maxDiscountPercent,
          defaultHoldMinutes: f.defaultHoldMinutes,
          depositPercent: f.depositPercent,
          takeoverMinutes: f.takeoverMinutes,
          autoCheckinWindowHours: f.autoCheckinWindowHours,
          manualReminderLeadHours: f.manualReminderLeadHours,
          dailyNeuronBudget: f.dailyNeuronBudget,
        },
      });
      if (res.data) onSaved(res.data.settings);
      toast.success("Đã lưu cấu hình AI.");
    } catch (e) {
      if (e instanceof AgentApiError && e.status === 409) toast.warning("Cấu hình vừa được người khác sửa — đã tải lại.");
      else err(e, "Không lưu được cấu hình.");
      if (e instanceof AgentApiError && e.status === 409) {
        const r = await agentApi<{ settings: AgentSettings }>("settings");
        if (r.data) onSaved(r.data.settings);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={card}>
        <p className="text-sm font-black text-slate-800">Tính cách & mô hình</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={label}>Tên AI</span>
            <input className={input} value={f.botName} onChange={(e) => setF({ ...f, botName: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className={label}>Hotline</span>
            <input className={input} value={f.hotline} onChange={(e) => setF({ ...f, hotline: e.target.value })} />
          </label>
        </div>
        <label className="space-y-1 block">
          <span className={label}>Mô hình (Workers AI)</span>
          <input className={input} list="agent-models" value={f.modelId} onChange={(e) => setF({ ...f, modelId: e.target.value })} />
          <datalist id="agent-models">
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={f.supervisedMode} onChange={(e) => setF({ ...f, supervisedMode: e.target.checked })} />
          Chế độ giám sát — AI chỉ soạn nháp, nhân viên duyệt mới gửi
        </label>
        <label className="space-y-1 block">
          <span className={label}>Hướng dẫn tính cách (system prompt)</span>
          <textarea className={`${input} font-mono text-xs`} rows={14} value={f.personaPrompt} onChange={(e) => setF({ ...f, personaPrompt: e.target.value })} />
        </label>
      </div>
      <div className="space-y-4">
        <div className={card}>
          <p className="text-sm font-black text-slate-800">🌙 Giờ bận / nghỉ đêm</p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.quietHours.enabled} onChange={(e) => setF({ ...f, quietHours: { ...f.quietHours, enabled: e.target.checked } })} />
            Tự động bật mỗi ngày
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className={label}>Từ</span>
              <input type="time" className={input} value={f.quietHours.start} onChange={(e) => setF({ ...f, quietHours: { ...f.quietHours, start: e.target.value } })} />
            </label>
            <label className="space-y-1">
              <span className={label}>Đến</span>
              <input type="time" className={input} value={f.quietHours.end} onChange={(e) => setF({ ...f, quietHours: { ...f.quietHours, end: e.target.value } })} />
            </label>
            <label className="space-y-1">
              <span className={label}>Giữ thêm (phút)</span>
              <input type="number" className={input} value={f.quietHours.holdBufferMinutes} onChange={(e) => setF({ ...f, quietHours: { ...f.quietHours, holdBufferMinutes: Number(e.target.value) } })} />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className={label}>Tin nhắn tự động khi bận</span>
            <textarea className={input} rows={4} value={f.busyAutoReplyTemplate} onChange={(e) => setF({ ...f, busyAutoReplyTemplate: e.target.value })} />
            <span className="text-[11px] text-slate-500">Biến: {"{room_name} {hold_until} {quiet_start} {quiet_end} {busy_until} {hotline} {guest_name}"}</span>
          </label>
        </div>
        <div className={card}>
          <p className="text-sm font-black text-slate-800">Quy tắc giữ phòng & nhận phòng</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(
              [
                ["defaultHoldMinutes", "Giữ phòng (phút)"],
                ["depositPercent", "Cọc (%)"],
                ["maxDiscountPercent", "AI được giảm tối đa (%)"],
                ["takeoverMinutes", "Tiếp quản (phút)"],
                ["autoCheckinWindowHours", "Tự gửi mã nếu nhận phòng ≤ (giờ)"],
                ["manualReminderLeadHours", "Nhắc gửi tay trước (giờ)"],
                ["dailyNeuronBudget", "Hạn mức neuron/ngày"],
              ] as Array<[keyof AgentSettings, string]>
            ).map(([k, l]) => (
              <label key={k} className="space-y-1">
                <span className={label}>{l}</span>
                <input type="number" className={input} value={Number(f[k])} onChange={num(k)} />
              </label>
            ))}
          </div>
          <label className="space-y-1 block">
            <span className={label}>Mẫu tin hướng dẫn nhận phòng (có mã cửa)</span>
            <textarea className={input} rows={7} value={f.checkinMessageTemplate} onChange={(e) => setF({ ...f, checkinMessageTemplate: e.target.value })} />
            <span className="text-[11px] text-slate-500">Biến: {"{room_name} {room_number} {floor_label} {checkin_time} {checkout_time} {gate_code} {lockbox_code} {maps_url} {hotline} {guest_name}"}</span>
          </label>
        </div>
        <div className="flex justify-end">
          <button disabled={saving} onClick={save} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
            💾 Lưu cấu hình
          </button>
        </div>
        <p className="text-[11px] text-slate-500 text-right">Chỉ quản lý (manager) được lưu. Bảng giá & khuyến mãi sửa ở trang <Link href="/promotions" className="underline">Ưu đãi</Link> — AI luôn báo giá theo Booking Core.</p>
      </div>
    </div>
  );
}

// ── Tab 2: door-code vault ──────────────────────────────────────────────────────────────────
interface GateCode {
  id: string;
  code: string;
  label: string | null;
  validFrom: string;
  validUntil: string | null;
  state: "current" | "scheduled" | "expired" | "inactive";
  source: string;
}
interface Lockbox {
  roomId: string;
  roomNumber: string;
  code: string | null;
  updatedAt: string | null;
}

function CodesTab() {
  const toast = useToast();
  const err = useErr();
  const [reveal, setReveal] = useState(false);
  const [gates, setGates] = useState<GateCode[]>([]);
  const [boxes, setBoxes] = useState<Lockbox[]>([]);
  const [newGate, setNewGate] = useState({ code: "", label: "", validFrom: "", validUntil: "" });
  const [boxInput, setBoxInput] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await agentApi<{ gateCodes: GateCode[]; lockboxes: Lockbox[] }>(`door-codes${reveal ? "?reveal=1" : ""}`);
    setGates(r.data?.gateCodes ?? []);
    setBoxes(r.data?.lockboxes ?? []);
  }, [reveal]);
  useEffect(() => {
    load().catch((e) => err(e, "Không tải được kho mã cửa."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const toIso = (local: string) => (local ? new Date(`${local}:00+07:00`).toISOString() : undefined);
  const addGate = async () => {
    try {
      const r = await agentApi<{ releasedSchedules: number }>("door-codes/gate", {
        method: "POST",
        body: { code: newGate.code, label: newGate.label || undefined, validFrom: toIso(newGate.validFrom), validUntil: toIso(newGate.validUntil) },
      });
      toast.success(`Đã lưu mã cổng.${r.data?.releasedSchedules ? ` Đã gửi ${r.data.releasedSchedules} hướng dẫn đang chờ.` : ""}`);
      setNewGate({ code: "", label: "", validFrom: "", validUntil: "" });
      await load();
    } catch (e) {
      err(e, "Không lưu được mã cổng.");
    }
  };
  const saveBox = async (roomId: string) => {
    try {
      await agentApi(`door-codes/lockbox/${roomId}`, { method: "PUT", body: { code: boxInput[roomId] } });
      toast.success("Đã lưu mã hộp khóa.");
      setBoxInput({ ...boxInput, [roomId]: "" });
      await load();
    } catch (e) {
      err(e, "Không lưu được mã hộp khóa.");
    }
  };
  const deactivate = async (id: string) => {
    try {
      await agentApi(`door-codes/gate/${id}/deactivate`, { method: "POST" });
      await load();
    } catch (e) {
      err(e, "Không tắt được mã.");
    }
  };
  const stateBadge: Record<GateCode["state"], string> = {
    current: "bg-emerald-50 text-emerald-800 border-emerald-200",
    scheduled: "bg-sky-50 text-sky-800 border-sky-200",
    expired: "bg-slate-100 text-slate-500 border-slate-200",
    inactive: "bg-slate-100 text-slate-400 border-slate-200",
  };
  const stateLabel = { current: "🟢 Đang dùng", scheduled: "🔵 Sắp áp dụng", expired: "⚪ Hết hạn", inactive: "⚪ Đã tắt" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Mã chỉ lưu mã hóa trong agent-db, không bao giờ vào nhật ký hay AI. Mã cổng thay đổi theo thời gian; mã hộp khóa cố định theo phòng.</p>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Hiện mã
        </label>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <p className="text-sm font-black text-slate-800">🚪 Mã cổng (thay đổi định kỳ)</p>
          <div className="grid grid-cols-2 gap-2">
            <input className={`${input} font-mono`} placeholder="Mã, VD 2580#" value={newGate.code} onChange={(e) => setNewGate({ ...newGate, code: e.target.value })} inputMode="numeric" />
            <input className={input} placeholder="Ghi chú (tuỳ chọn)" value={newGate.label} onChange={(e) => setNewGate({ ...newGate, label: e.target.value })} />
            <label className="space-y-1">
              <span className={label}>Hiệu lực từ (để trống = ngay)</span>
              <input type="datetime-local" className={input} value={newGate.validFrom} onChange={(e) => setNewGate({ ...newGate, validFrom: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className={label}>Đến (để trống = đến khi đổi)</span>
              <input type="datetime-local" className={input} value={newGate.validUntil} onChange={(e) => setNewGate({ ...newGate, validUntil: e.target.value })} />
            </label>
          </div>
          <button disabled={!newGate.code} onClick={addGate} className={`${btn} bg-emerald-600 text-white`}>
            💾 Lưu mã cổng
          </button>
          <ul className="divide-y divide-slate-100">
            {gates.map((g) => (
              <li key={g.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-mono font-bold text-slate-900">{g.code}</span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${stateBadge[g.state]}`}>{stateLabel[g.state]}</span>
                  <p className="text-[11px] text-slate-500">
                    {formatVnTime(g.validFrom)} → {g.validUntil ? formatVnTime(g.validUntil) : "không giới hạn"} · {g.source === "telegram" ? "Telegram" : "Web"}
                    {g.label ? ` · ${g.label}` : ""}
                  </p>
                </div>
                {g.state !== "inactive" && (
                  <button onClick={() => deactivate(g.id)} className="text-xs font-bold text-rose-700 hover:underline">
                    Tắt
                  </button>
                )}
              </li>
            ))}
            {gates.length === 0 && <li className="py-2 text-xs text-amber-700">Chưa có mã cổng — AI sẽ hỏi bạn qua Telegram khi cần.</li>}
          </ul>
          <p className="text-[11px] text-slate-500">Mẹo: nhắn <code>/code 2580#</code> hoặc <code>/code 2580# 05/11-12/11</code> cho bot Telegram.</p>
        </div>
        <div className={card}>
          <p className="text-sm font-black text-slate-800">📦 Mã hộp khóa theo phòng (cố định)</p>
          <ul className="space-y-2">
            {boxes.map((b) => (
              <li key={b.roomId} className="flex items-center gap-2">
                <span className="w-28 text-sm font-bold text-slate-800">{ROOMS.find((r) => r.id === b.roomId)?.label ?? b.roomNumber}</span>
                <span className={`w-20 font-mono text-sm ${b.code ? "text-slate-900" : "text-amber-700"}`}>{b.code ?? "Chưa có"}</span>
                <input className={`${input} font-mono flex-1 min-w-0`} placeholder="Mã mới" value={boxInput[b.roomId] ?? ""} onChange={(e) => setBoxInput({ ...boxInput, [b.roomId]: e.target.value })} inputMode="numeric" />
                <button disabled={!boxInput[b.roomId]} onClick={() => saveBox(b.roomId)} className={`${btn} bg-slate-800 text-white`}>
                  Lưu
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500">Hoặc nhắn <code>/lockbox 102 1234</code> cho bot Telegram.</p>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: knowledge documents (RAG) ────────────────────────────────────────────────────────
interface Doc {
  id: string;
  title: string;
  category: string;
  chunk_count: number;
  status: "pending" | "indexed" | "error";
  last_error: string | null;
  isActive: boolean;
  version: number;
  updated_at: string;
  size: number;
}
const CATEGORIES = [
  ["house_rules", "Nội quy"],
  ["checkin_guide", "Hướng dẫn nhận phòng"],
  ["room_info", "Thông tin phòng"],
  ["local_guide", "Ăn uống / xung quanh"],
  ["policy", "Chính sách"],
  ["general", "Chung"],
] as const;

function KnowledgeTab() {
  const toast = useToast();
  const err = useErr();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [editing, setEditing] = useState<{ id?: string; version?: number; title: string; category: string; content: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await agentApi<{ documents: Doc[] }>("knowledge/documents");
    setDocs(r.data?.documents ?? []);
  }, []);
  useEffect(() => {
    load().catch((e) => err(e, "Không tải được kho kiến thức."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const open = async (id: string) => {
    const r = await agentApi<{ document: { id: string; title: string; category: string; raw_content: string; version: number } }>(`knowledge/documents/${id}`);
    const d = r.data!.document;
    setEditing({ id: d.id, version: d.version, title: d.title, category: d.category, content: d.raw_content });
  };
  const save = async () => {
    if (!editing) return;
    try {
      if (editing.id) await agentApi(`knowledge/documents/${editing.id}`, { method: "PUT", body: { expectedVersion: editing.version, title: editing.title, category: editing.category, content: editing.content } });
      else await agentApi("knowledge/documents", { method: "POST", body: { title: editing.title, category: editing.category, content: editing.content } });
      toast.success("Đã lưu tài liệu — bấm “Lập chỉ mục” để AI dùng được.");
      setEditing(null);
      await load();
    } catch (e) {
      err(e, "Không lưu được tài liệu.");
    }
  };
  const index = async (id: string) => {
    setBusyId(id);
    try {
      const r = await agentApi<{ chunks: number }>(`knowledge/documents/${id}/index`, { method: "POST" });
      toast.success(`Đã lập chỉ mục ${r.data?.chunks ?? 0} đoạn.`);
      await load();
    } catch (e) {
      err(e, "Lập chỉ mục thất bại.");
    } finally {
      setBusyId(null);
    }
  };
  const remove = async (id: string) => {
    try {
      await agentApi(`knowledge/documents/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      err(e, "Không xoá được.");
    }
  };
  const onFile = async (file: File) => {
    if (!/\.(md|txt)$/i.test(file.name)) return toast.warning("Chỉ nhận .md hoặc .txt (PDF: copy nội dung vào ô soạn thảo).");
    setEditing({ title: file.name.replace(/\.(md|txt)$/i, ""), category: "general", content: await file.text() });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-xs text-slate-500">Nội quy, đường đi, tiện nghi… AI tra cứu khi khách hỏi. Không đưa giá (lấy từ Booking Core) hay mã cửa (Kho mã cửa) vào đây.</p>
        <div className="flex gap-2">
          <label className={`${btn} bg-white border border-slate-300 text-slate-700 cursor-pointer`}>
            ⬆️ Tải .md/.txt
            <input type="file" accept=".md,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <button onClick={() => setEditing({ title: "", category: "general", content: "" })} className={`${btn} bg-emerald-600 text-white`}>
            ＋ Soạn tài liệu
          </button>
        </div>
      </div>
      {editing && (
        <div className={card}>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-2">
            <input className={input} placeholder="Tiêu đề" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <select className={input} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
              {CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <textarea className={`${input} font-mono text-xs`} rows={14} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className={`${btn} text-slate-600`}>
              Huỷ
            </button>
            <button disabled={!editing.title || editing.content.length < 10} onClick={save} className={`${btn} bg-emerald-600 text-white`}>
              💾 Lưu
            </button>
          </div>
        </div>
      )}
      <div className={card}>
        <ul className="divide-y divide-slate-100">
          {docs.map((d) => (
            <li key={d.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-800">{d.title}</p>
                <p className="text-[11px] text-slate-500">
                  {CATEGORIES.find(([v]) => v === d.category)?.[1] ?? d.category} · {d.size} ký tự ·{" "}
                  {d.status === "indexed" ? `🟢 ${d.chunk_count} đoạn đã lập chỉ mục` : d.status === "error" ? `🔴 Lỗi: ${d.last_error ?? ""}` : "🟡 Chưa lập chỉ mục"}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button disabled={busyId === d.id} onClick={() => index(d.id)} className={`${btn} bg-slate-800 text-white`}>
                  {busyId === d.id ? "Đang lập…" : "Lập chỉ mục"}
                </button>
                <button onClick={() => open(d.id)} className={`${btn} bg-white border border-slate-300 text-slate-700`}>
                  Sửa
                </button>
                <button onClick={() => remove(d.id)} className={`${btn} text-rose-700`}>
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Tab 4: exact FAQs ───────────────────────────────────────────────────────────────────────
interface Faq {
  id: string;
  canonical_question: string;
  question_keywords: string;
  exact_answer: string;
  priority: number;
  isActive: boolean;
  version: number;
}

function FaqTab() {
  const toast = useToast();
  const err = useErr();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [form, setForm] = useState({ question: "", keywords: "", answer: "" });
  const load = useCallback(async () => {
    const r = await agentApi<{ faqs: Faq[] }>("faqs");
    setFaqs(r.data?.faqs ?? []);
  }, []);
  useEffect(() => {
    load().catch((e) => err(e, "Không tải được FAQ."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  const add = async () => {
    try {
      await agentApi("faqs", { method: "POST", body: form });
      setForm({ question: "", keywords: "", answer: "" });
      toast.success("Đã thêm FAQ.");
      await load();
    } catch (e) {
      err(e, "Không thêm được FAQ.");
    }
  };
  const update = async (f: Faq, patch: Record<string, unknown>) => {
    try {
      await agentApi(`faqs/${f.id}`, { method: "PUT", body: { expectedVersion: f.version, ...patch } });
      await load();
    } catch (e) {
      err(e, "Không cập nhật được FAQ.");
      await load();
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Câu hỏi khớp từ khoá sẽ được trả lời NGUYÊN VĂN, không qua AI (nhanh, không tốn neuron). Câu hỏi về đặt phòng/giá luôn đi qua AI + Booking Core.</p>
      <div className={card}>
        <input className={input} placeholder="Câu hỏi mẫu" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        <input className={input} placeholder="Từ khoá, cách nhau bằng dấu phẩy (VD: wifi, mật khẩu wifi)" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
        <textarea className={input} rows={3} placeholder="Câu trả lời chính xác" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        <button disabled={!form.question || !form.answer} onClick={add} className={`${btn} bg-emerald-600 text-white`}>
          ＋ Thêm FAQ
        </button>
      </div>
      <ul className="space-y-2">
        {faqs.map((f) => (
          <li key={f.id} className={card}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-slate-800">{f.canonical_question}</p>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                <input type="checkbox" checked={f.isActive} onChange={(e) => update(f, { isActive: e.target.checked })} /> Bật
              </label>
            </div>
            <p className="text-[11px] text-slate-500">Từ khoá: {f.question_keywords || "—"}</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{f.exact_answer}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Tab 5: tool switches + Telegram staff mapping ───────────────────────────────────────────
function ToolsTab({ settings, onSaved }: { settings: AgentSettings; onSaved: (s: AgentSettings) => void }) {
  const toast = useToast();
  const err = useErr();
  const [switches, setSwitches] = useState(settings.toolSwitches);
  const [rows, setRows] = useState(Object.entries(settings.telegramStaffMap).map(([tg, v]) => ({ tg, ...v })));
  useEffect(() => {
    setSwitches(settings.toolSwitches);
    setRows(Object.entries(settings.telegramStaffMap).map(([tg, v]) => ({ tg, ...v })));
  }, [settings]);
  const save = async () => {
    try {
      const map = Object.fromEntries(rows.filter((r) => r.tg).map((r) => [r.tg.trim(), { staffId: Number(r.staffId), role: r.role, name: r.name }]));
      const res = await agentApi<{ settings: AgentSettings }>("settings", { method: "PUT", body: { expectedVersion: settings.version, toolSwitches: switches, telegramStaffMap: map } });
      if (res.data) onSaved(res.data.settings);
      toast.success("Đã lưu.");
    } catch (e) {
      err(e, "Không lưu được.");
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={card}>
        <p className="text-sm font-black text-slate-800">Công tắc quyền của AI</p>
        <p className="text-[11px] text-slate-500">AI không bao giờ có quyền xác nhận đơn — chỉ giữ phòng. Xác nhận luôn do bạn bấm.</p>
        {Object.keys(TOOL_LABELS).map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!switches[k]} disabled={k === "update_booking"} onChange={(e) => setSwitches({ ...switches, [k]: e.target.checked })} />
            {TOOL_LABELS[k]} <code className="text-[10px] text-slate-400">{k}</code>
          </label>
        ))}
      </div>
      <div className={card}>
        <p className="text-sm font-black text-slate-800">✈️ Người được duyệt trên Telegram</p>
        <p className="text-[11px] text-slate-500">Mỗi người gõ <code>/whoami</code> trong nhóm Telegram để lấy ID, rồi thêm ở đây (ID nhân viên = ID đăng nhập Admin).</p>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_110px_1fr_auto] gap-1.5 items-center">
            <input className={`${input} font-mono`} placeholder="Telegram ID" value={r.tg} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, tg: e.target.value } : x)))} />
            <input className={input} placeholder="Staff ID" value={r.staffId} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, staffId: Number(e.target.value) } : x)))} />
            <select className={input} value={r.role} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, role: e.target.value as "manager" | "receptionist" } : x)))}>
              <option value="manager">manager</option>
              <option value="receptionist">receptionist</option>
            </select>
            <input className={input} placeholder="Tên" value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-xs font-bold text-rose-700">
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => setRows([...rows, { tg: "", staffId: 1, role: "manager", name: "" }])} className={`${btn} bg-white border border-slate-300 text-slate-700`}>
          ＋ Thêm người
        </button>
      </div>
      <div className="lg:col-span-2 flex justify-between items-center">
        <Link href="/agent-inbox" className="text-xs font-bold text-emerald-700 underline">
          → Chat thử với AI trong Hộp thư (Sandbox)
        </Link>
        <button onClick={save} className={`${btn} bg-emerald-600 text-white`}>
          💾 Lưu
        </button>
      </div>
    </div>
  );
}

export function AgentConfig() {
  const err = useErr();
  const [tab, setTab] = useState<Tab>("persona");
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  useEffect(() => {
    agentApi<{ settings: AgentSettings }>("settings")
      .then((r) => r.data && setSettings(r.data.settings))
      .catch((e) => err(e, "Không kết nối được AI Lễ Tân."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">⚙️ Cấu hình AI Lễ Tân</h1>
          <p className="text-xs sm:text-sm text-slate-500">Tính cách, giờ bận, kho mã cửa, kiến thức và quyền của AI. Không cần sửa code.</p>
        </div>
        <div className="w-full sm:w-80">
          <BusyToggle settings={settings} onChange={setSettings} />
        </div>
      </header>
      <div className="flex items-center bg-slate-200/80 p-1 rounded-xl flex-wrap gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3.5 py-2 rounded-lg text-xs font-bold ${tab === t.key ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {!settings ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : tab === "persona" ? (
        <PersonaTab settings={settings} onSaved={setSettings} />
      ) : tab === "codes" ? (
        <CodesTab />
      ) : tab === "knowledge" ? (
        <KnowledgeTab />
      ) : tab === "faq" ? (
        <FaqTab />
      ) : (
        <ToolsTab settings={settings} onSaved={setSettings} />
      )}
    </div>
  );
}
