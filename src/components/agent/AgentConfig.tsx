"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { agentApi, AgentApiError, formatVnTime, ROOMS, type AgentSettings } from "@/lib/agentApi";
import { useToast } from "@/components/ui/Toast";
import { BusyToggle } from "./BusyToggle";
import { RouterCheck } from "./RouterCheck";
import { apiFetch } from "@/lib/apiClient";
import { getCachedStaffIdentity } from "@/lib/localCache";

type Tab = "persona" | "offers" | "codes" | "knowledge" | "faq" | "tools";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "persona", label: "🧑‍💼 Tính cách & Giờ bận" },
  { key: "offers", label: "🎁 Ưu đãi public" },
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
  ask_owner: "Chuyển quản lí",
  report_issue: "Báo sự cố khẩn",
  send_room_info: "Gửi thẻ ảnh phòng + link web",
  troubleshoot_issue: "Xử lý sự cố cấp 1 (xem ảnh, hướng dẫn khách)",
  close_issue: "Đóng sự cố / chuyển quản lí kèm ảnh",
  note_payment_receipt: "Đọc ảnh bill chuyển khoản để đối chiếu",
  request_deposit_exception: "Xin quản lí cho cọc (booking sát ngày)",
  request_extension: "Thêm giờ cho khách đang ở (quản lí duyệt)",
  request_stay_change: "Khách có đơn xin nhận sớm / trả muộn (quản lí duyệt)",
  get_offers: "Đọc ưu đãi public (Booking Core)",
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
  useEffect(() => {
    setF(settings);
  }, [settings]);
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
          depositMinLeadDays: f.depositMinLeadDays,
          burstWaitSeconds: f.burstWaitSeconds,
          ...(f.router ? { router: f.router } : {}),
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
                ["depositMinLeadDays", "Chỉ nhận cọc khi đặt trước ≥ (ngày)"],
                ["burstWaitSeconds", "Đợi khách nhắn hết ý (giây, 0 = tắt)"],
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
        {f.router && (
          <div className={card}>
            <p className="text-sm font-black text-slate-800">🧭 Điều phối hội thoại bằng AI</p>
            <p className="text-xs text-slate-500">AI đọc cả cuộc trò chuyện để chọn đúng kịch bản (kể cả kịch bản bạn tự tạo, theo câu “Khi nào”). Không bao giờ tự báo giá hay tự trả lời khách.</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Chế độ điều phối">
              {(
                [
                  ["off", "Tắt", "Chỉ dùng luật"],
                  ["shadow", "Chạy thử", "Ghi vào Truy vết AI, hội thoại vẫn theo luật"],
                  ["on", "Bật", "Dùng khi AI đủ chắc"],
                ] as const
              ).map(([m, l, d]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={f.router!.mode === m}
                  onClick={() => setF({ ...f, router: { ...f.router!, mode: m } })}
                  className={`flex-1 min-w-[140px] rounded-xl border px-3 py-2 text-left transition ${f.router!.mode === m ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  <span className="block text-sm font-bold">{l}</span>
                  <span className="block text-[11px] text-slate-500">{d}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={label}>Độ chắc tối thiểu (%)</span>
                <input type="number" min={0} max={100} className={input} value={Math.round(f.router.minConfidence * 100)} onChange={(e) => setF({ ...f, router: { ...f.router!, minConfidence: Math.max(0, Math.min(100, Number(e.target.value))) / 100 } })} />
              </label>
              <label className="space-y-1">
                <span className={label}>Model (trống = model trả lời)</span>
                <input className={input} placeholder={f.modelId} value={f.router.model ?? ""} onChange={(e) => setF({ ...f, router: { ...f.router!, model: e.target.value.trim() || null } })} />
              </label>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-sm font-bold text-slate-800">Hiểu ý khách và viết câu tự nhiên</p>
              <p className="text-xs text-slate-500">AI đọc ý khách ở mỗi bước đặt phòng (chọn hạng hay số phòng, phản đối, muốn gặp quản lí) rồi viết lại câu của hệ thống cho tự nhiên. Giá, danh sách phòng và thông tin chuyển khoản luôn giữ nguyên từ hệ thống; câu viết lại sai số là gửi câu mẫu.</p>
              {(
                [
                  ["understand", "Hiểu ý khách bằng AI", [["on", "Bật"], ["off", "Tắt (chỉ dùng luật)"]]],
                  ["writer", "Viết lại câu bán hàng", [["on", "Bật"], ["off", "Tắt (gửi đúng mẫu tin)"]]],
                  ["thinking", "Đọc kỹ lượt khó", [["auto", "Tự đọc lại có suy nghĩ khi khách phản đối, mặc cả, bực, hỏi nhiều ý hoặc AI chưa chắc"], ["off", "Tắt"]]],
                ] as const
              ).map(([key, title, opts]) => (
                <label key={key} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2">
                  <span className="text-sm text-slate-700">{title}</span>
                  <select
                    className={input}
                    value={(f.router![key] as string | undefined) ?? opts[0][0]}
                    onChange={(e) => setF({ ...f, router: { ...f.router!, [key]: e.target.value } })}
                  >
                    {opts.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <p className="text-[11px] text-slate-500">Đọc kỹ chỉ chạy ở lượt khó: câu trả lời lượt đó chậm thêm khoảng 5–45 giây và tốn thêm khoảng 30–80 neuron. Lượt bình thường không đổi.</p>
            </div>
            <RouterCheck model={f.router.model} />
          </div>
        )}
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

// ── Ưu đãi public (AI-8) ──────────────────────────────────────────────────────────────────────
/** Light view of GET /api/promotions (legacy snake_case shape from coreMappers). */
interface PromoRow {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount: number;
  applicable_room_classes: string[];
  applicable_booking_types: string[];
  applicable_days_of_week?: number[];
  applicable_loyalty_tiers: string[];
  start_date: string | null;
  end_date: string | null;
  min_nights?: number;
  is_public?: number;
  is_active: number;
}
const vnd = (n: number) => `${n.toLocaleString("vi-VN").replace(/,/g, ".")}đ`;
const DAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const TYPE_VI: Record<string, string> = { hourly: "theo giờ", overnight: "qua đêm", dayuse: "theo ngày" };
/** Same wording as agent-core offerLine() — what Home reads from get_offers. */
function offerText(p: PromoRow): { off: string; cond: string[] } {
  const off = p.discount_type === "percentage" ? `Giảm ${p.discount_value}%${p.max_discount_amount ? ` (tối đa ${vnd(p.max_discount_amount)})` : ""}` : `Giảm ${vnd(p.discount_value)}`;
  const cond = [
    p.applicable_booking_types?.length ? p.applicable_booking_types.map((t) => TYPE_VI[t] ?? t).join(" / ") : "",
    p.applicable_room_classes?.length ? p.applicable_room_classes.map((c) => (c === "signature" ? "Signature" : "Haven")).join(" / ") : "",
    p.applicable_days_of_week?.length ? p.applicable_days_of_week.map((d) => DAY_SHORT[d]).join(", ") : "",
    (p.min_nights ?? 1) > 1 ? `từ ${p.min_nights} đêm` : "",
    p.min_order_amount > 0 ? `đơn từ ${vnd(p.min_order_amount)}` : "",
    p.applicable_loyalty_tiers?.length && !p.applicable_loyalty_tiers.includes("not_member") ? `hạng ${p.applicable_loyalty_tiers.join(" / ")}` : "",
    p.end_date ? `đến ${p.end_date.split("-").reverse().join("/")}` : "",
  ].filter(Boolean);
  return { off, cond };
}

function OffersTab() {
  const toast = useToast();
  const [rows, setRows] = useState<PromoRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const load = useCallback(async () => {
    const res = await apiFetch("/api/promotions?status=active");
    if (!res.ok) throw new Error("load");
    const data = (await res.json()) as { promotions: PromoRow[] };
    setRows(data.promotions ?? []);
  }, []);
  useEffect(() => {
    setIsManager(getCachedStaffIdentity()?.role === "manager");
    load().catch(() => {
      setRows([]);
      toast.error("Không tải được danh sách ưu đãi.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  const toggle = async (p: PromoRow, on: boolean) => {
    setBusy(p.id);
    setRows((r) => r?.map((x) => (x.id === p.id ? { ...x, is_public: on ? 1 : 0 } : x)) ?? r);
    try {
      const res = await apiFetch(`/api/promotions/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_public: on ? 1 : 0 }) });
      if (!res.ok) throw new Error("patch");
      toast.success(on ? `Home sẽ giới thiệu và tự áp “${p.name}”.` : `Home không còn tự áp “${p.name}”.`);
      await load();
    } catch {
      toast.error("Không cập nhật được. Chỉ quản lí được bật/tắt ưu đãi.");
      await load().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };
  const pub = rows?.filter((p) => p.is_public === 1) ?? [];
  const priv = rows?.filter((p) => p.is_public !== 1) ?? [];
  const item = (p: PromoRow) => {
    const t = offerText(p);
    const on = p.is_public === 1;
    return (
      <li key={p.id} className="flex items-start gap-3 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{p.name}</span>
            {p.code ? <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">{p.code}</span> : null}
          </span>
          <span className="mt-0.5 block text-sm text-emerald-800">{t.off}</span>
          <span className="block text-xs text-slate-500">{t.cond.length ? t.cond.join(" · ") : "Mọi khung giờ, mọi phòng"}</span>
          {p.description ? <span className="mt-1 block text-xs text-slate-600">{p.description}</span> : null}
        </span>
        <label className={`flex shrink-0 items-center gap-2 text-xs font-semibold ${isManager ? "cursor-pointer text-slate-700" : "text-slate-400"}`} title={isManager ? "" : "Chỉ quản lí bật/tắt được"}>
          <input type="checkbox" className="h-4 w-4 rounded text-emerald-600" checked={on} disabled={!isManager || busy === p.id} onChange={(e) => toggle(p, e.target.checked)} />
          Công khai
        </label>
      </li>
    );
  };
  const sample = pub[0] ? offerText(pub[0]) : null;
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Ưu đãi <b>công khai</b> được Home giới thiệu khi khách hỏi, và hệ thống <b>tự áp</b> vào giá Home báo (không cần mã) — chọn ưu đãi tốt nhất khách đủ điều kiện. Ưu đãi không công khai chỉ áp khi khách đưa mã. Home không bao giờ tự tính giá: mọi con số lấy từ Booking Core.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4">
          <section className={`${card} !p-0 overflow-hidden`}>
            <h3 className="px-4 pt-4 text-sm font-bold text-slate-900">🤖 Home đang giới thiệu ({pub.length})</h3>
            {rows === null ? (
              <p className="px-4 pb-4 text-sm text-slate-500">Đang tải…</p>
            ) : pub.length ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">{pub.map(item)}</ul>
            ) : (
              <p className="px-4 pb-4 text-sm text-slate-500">Chưa có ưu đãi công khai. Khách hỏi khuyến mãi, Home sẽ nói giá đang báo đã là giá tốt nhất.</p>
            )}
          </section>
          {priv.length ? (
            <section className={`${card} !p-0 overflow-hidden`}>
              <h3 className="px-4 pt-4 text-sm font-bold text-slate-900">Ưu đãi đang chạy, chưa công khai ({priv.length})</h3>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">{priv.map(item)}</ul>
            </section>
          ) : null}
          <Link href="/promotions" className="inline-flex text-sm font-semibold text-emerald-800 hover:underline">
            ＋ Tạo / sửa ưu đãi ở trang Khuyến mãi →
          </Link>
        </div>
        <aside className={`${card} h-fit`}>
          <p className={label}>Khách hỏi “có khuyến mãi gì không?”</p>
          <div className="rounded-2xl rounded-tl-sm bg-emerald-50 px-3 py-2 text-sm text-slate-800">
            {sample ? (
              <>
                Dạ bên mình đang có ưu đãi <b>{pub[0]!.name}</b>: {sample.off.toLowerCase()}
                {sample.cond.length ? `, áp dụng ${sample.cond.join(", ")}` : ""} ạ 😊 Bạn cho Home ngày giờ ở, Home báo giá đã giảm cho mình liền nha.
              </>
            ) : (
              <>Dạ hiện bên mình chưa có chương trình ưu đãi nào ạ. Giá Home báo đã là giá tốt nhất cho khung giờ của bạn nha 😊</>
            )}
          </div>
          <p className="text-xs text-slate-500">Minh hoạ. Home viết theo giọng của mình, nhưng mức giảm và giá sau giảm luôn lấy từ hệ thống.</p>
        </aside>
      </div>
    </div>
  );
}

// ── Meta allowlist (AR-2) ─────────────────────────────────────────────────────────────────────
const lines = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

function MetaAccessCard({ settings, onSaved }: { settings: AgentSettings; onSaved: (s: AgentSettings) => void }) {
  const toast = useToast();
  const err = useErr();
  const m = settings.metaAccess;
  const [mode, setMode] = useState(m.mode);
  const [fbNames, setFbNames] = useState(m.facebook.names.join("\n"));
  const [igUsers, setIgUsers] = useState(m.instagram.usernames.join("\n"));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setMode(settings.metaAccess.mode);
    setFbNames(settings.metaAccess.facebook.names.join("\n"));
    setIgUsers(settings.metaAccess.instagram.usernames.join("\n"));
  }, [settings]);
  const save = async () => {
    if (mode === "open" && !window.confirm("Chế độ MỞ: AI sẽ trả lời MỌI khách nhắn Fanpage/Instagram. Chỉ bật khi đã chốt chuyển đổi (cutover). Tiếp tục?")) return;
    setSaving(true);
    try {
      const body = {
        expectedVersion: settings.version,
        metaAccess: { mode, facebook: { names: lines(fbNames), ids: m.facebook.ids }, instagram: { usernames: lines(igUsers), ids: m.instagram.ids } },
      };
      const res = await agentApi<{ settings: AgentSettings }>("settings", { method: "PUT", body });
      if (res.data) onSaved(res.data.settings);
      toast.success("Đã lưu danh sách Meta.");
    } catch (e) {
      err(e, "Không lưu được danh sách Meta.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={`${card} lg:col-span-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black text-slate-800">📘 Facebook / Instagram — AI trả lời ai?</p>
        <select className={`${input} w-auto`} value={mode} onChange={(e) => setMode(e.target.value as "allowlist" | "open")}>
          <option value="allowlist">Chỉ danh sách bên dưới (thử nghiệm)</option>
          <option value="open">MỞ — mọi khách (chỉ khi cutover)</option>
        </select>
      </div>
      <p className="text-[11px] text-slate-500">
        Người không có trong danh sách: AI <b>im lặng</b> và hệ thống <b>không lưu</b> tin nhắn của họ (họ vẫn thấy trong hộp thư Meta như bình thường).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className={label}>Tên Facebook (mỗi dòng một tên)</p>
          <textarea className={`${input} h-20`} value={fbNames} onChange={(e) => setFbNames(e.target.value)} placeholder="Đinh Gia Huy" />
          {m.facebook.ids.length > 0 && <p className="text-[10px] text-slate-400">+ {m.facebook.ids.length} ID cố định</p>}
        </div>
        <div className="space-y-1">
          <p className={label}>Username Instagram (mỗi dòng một username)</p>
          <textarea className={`${input} h-20 font-mono`} value={igUsers} onChange={(e) => setIgUsers(e.target.value)} placeholder="huykhongnguu" />
          {m.instagram.ids.length > 0 && <p className="text-[10px] text-slate-400">+ {m.instagram.ids.length} ID cố định</p>}
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className={`${btn} bg-emerald-600 text-white`}>
          💾 Lưu danh sách Meta
        </button>
      </div>
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
      <MetaAccessCard settings={settings} onSaved={onSaved} />
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
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/agent-config/van-hanh"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            🧭 Vận hành AI
          </Link>
          <div className="w-full sm:w-80">
            <BusyToggle settings={settings} onChange={setSettings} />
          </div>
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
      ) : tab === "offers" ? (
        <OffersTab />
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
