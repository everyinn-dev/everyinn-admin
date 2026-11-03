"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  agentApi,
  AgentApiError,
  formatVnTime,
  MODE_META,
  type AgentConversation,
  type AgentEscalation,
  type AgentMessage,
  type AgentRun,
  type AgentSettings,
} from "@/lib/agentApi";
import { useToast } from "@/components/ui/Toast";
import { BusyToggle } from "./BusyToggle";
import { EscalationCard } from "./EscalationCard";

type Filter = "all" | "pending" | "ai" | "human";
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "🟡 Chờ duyệt" },
  { key: "ai", label: "🟢 AI trực" },
  { key: "human", label: "🔴 Sếp trực" },
];

/** Visible-tab interval polling with ETag (CONVENTIONS §7 — no WebSockets through OpenNext). */
function useVisibleInterval(fn: () => void, ms: number, deps: unknown[]) {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => document.visibilityState === "visible" && fn(), ms);
    };
    const onVis = () => document.visibilityState === "visible" && fn();
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function AgentInbox() {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [convs, setConvs] = useState<AgentConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conv, setConv] = useState<AgentConversation | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [escalations, setEscalations] = useState<AgentEscalation[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await agentApi<{ conversations: AgentConversation[] }>(`conversations?filter=${filter}`, { etag: etagRef.current });
      if (res.status === 304) return;
      etagRef.current = res.etag;
      setConvs(res.data?.conversations ?? []);
      setUnavailable(null);
    } catch (e) {
      setUnavailable(e instanceof AgentApiError ? e.message : "Không kết nối được AI Lễ Tân.");
    }
  }, [filter]);

  const loadThread = useCallback(async (id: string) => {
    try {
      const [detail, esc, rr] = await Promise.all([
        agentApi<{ conversation: AgentConversation; messages: AgentMessage[] }>(`conversations/${id}`),
        agentApi<{ escalations: AgentEscalation[] }>(`escalations?conversationId=${id}`),
        agentApi<{ runs: AgentRun[] }>(`conversations/${id}/runs`),
      ]);
      setConv(detail.data?.conversation ?? null);
      setMessages(detail.data?.messages ?? []);
      setEscalations(esc.data?.escalations ?? []);
      setRuns(rr.data?.runs ?? []);
    } catch (e) {
      toastRef.current.error(e instanceof AgentApiError ? e.message : "Không tải được hội thoại.");
    }
  }, []);

  useEffect(() => {
    etagRef.current = null;
    void loadList();
  }, [loadList]);
  useEffect(() => {
    agentApi<{ settings: AgentSettings }>("settings").then((r) => r.data && setSettings(r.data.settings)).catch(() => null);
  }, []);
  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
  }, [selectedId, loadThread]);
  useEffect(() => bottomRef.current?.scrollIntoView({ block: "end" }), [messages.length]);

  useVisibleInterval(() => void loadList(), 20_000, [loadList]);
  useVisibleInterval(() => selectedId && void loadThread(selectedId), 5_000, [selectedId, loadThread]);

  const refreshAll = async () => {
    etagRef.current = null;
    await loadList();
    if (selectedId) await loadThread(selectedId);
  };

  const sendSandbox = async () => {
    const text = composer.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await agentApi<{ conversation: AgentConversation; messages: AgentMessage[] }>("sandbox/messages", {
        method: "POST",
        body: { text, ...(conv?.channel === "sandbox" ? { conversationId: conv.id } : {}) },
      });
      setComposer("");
      if (res.data?.conversation) {
        setSelectedId(res.data.conversation.id);
        setConv(res.data.conversation);
        setMessages(res.data.messages);
      }
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "AI chưa trả lời được, thử lại.");
    } finally {
      setSending(false);
    }
  };

  const sendStaff = async () => {
    const text = composer.trim();
    if (!text || !conv) return;
    setSending(true);
    try {
      await agentApi(`conversations/${conv.id}/messages`, { method: "POST", body: { text } });
      setComposer("");
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Không gửi được.");
    } finally {
      setSending(false);
    }
  };

  const act = async (path: string, body?: unknown, ok?: string) => {
    try {
      await agentApi(path, { method: "POST", body: body ?? {} });
      if (ok) toast.success(ok);
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Thao tác thất bại.");
    }
  };

  const newSandbox = () => {
    setSelectedId(null);
    setConv(null);
    setMessages([]);
    setEscalations([]);
    setRuns([]);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">💬 Hộp thư AI Lễ Tân</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            AI “{settings?.botName ?? "Home"}” {settings?.supervisedMode ? "đang ở chế độ giám sát — mọi câu trả lời là bản nháp chờ duyệt" : "đang tự trả lời"}. Duyệt chuyển khoản, nhập mã cửa và tiếp quản tại đây hoặc trên Telegram.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={newSandbox} className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700">＋ Chat thử (Sandbox)</button>
          <Link href="/agent-config" className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">⚙️ Cấu hình AI</Link>
        </div>
      </header>

      {unavailable && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">{unavailable}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_300px] gap-4">
        {/* Column 1 — conversations */}
        <section className="space-y-3">
          <BusyToggle settings={settings} onChange={setSettings} />
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${filter === f.key ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {convs.length === 0 && <li className="p-4 text-xs text-slate-500 text-center bg-white rounded-xl border border-slate-200">Chưa có hội thoại. Bấm “Chat thử” để thử AI.</li>}
            {convs.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelectedId(c.id)} className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === c.id ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{c.senderName}</span>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatVnTime(c.lastMessageAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{c.lastMessagePreview ?? "—"}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${MODE_META[c.mode].cls}`}>{MODE_META[c.mode].label}</span>
                    <span className="text-[10px] text-slate-400 uppercase">{c.channel}</span>
                    {c.unreadCount > 0 && <span className="ml-auto px-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">{c.unreadCount}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Column 2 — thread */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col min-h-[60vh]">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-900">{conv ? conv.senderName : "Chat thử mới (Sandbox)"}</p>
              <p className="text-[11px] text-slate-500">{conv ? `${conv.channel}${conv.phone ? ` · ${conv.phone}` : ""}${conv.activeBookingId ? ` · Đơn ${conv.activeBookingId}` : ""}` : "Bạn nhắn với tư cách khách để xem AI trả lời — giữ phòng là thật trên môi trường hiện tại."}</p>
            </div>
            {conv && (
              <div className="flex gap-1.5">
                {conv.mode === "HUMAN_TAKEOVER" ? (
                  <button onClick={() => act(`conversations/${conv.id}/release`, undefined, "Đã giao lại cho AI.")} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">🤖 Giao lại cho AI</button>
                ) : (
                  <button onClick={() => act(`conversations/${conv.id}/takeover`, undefined, "AI sẽ im lặng với khách này.")} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">🖐️ Tiếp quản {Math.round((settings?.takeoverMinutes ?? 120) / 60)}h</button>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[60vh]">
            {messages.map((m) => {
              const mine = m.senderType !== "guest";
              const draft = m.status === "draft_pending_approval";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                      draft ? "bg-amber-50 border border-amber-300" : m.status === "rejected" ? "bg-slate-100 text-slate-400 line-through" : mine ? (m.senderType === "staff" ? "bg-sky-50 border border-sky-200" : "bg-emerald-50 border border-emerald-200") : "bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <p className="text-[10px] font-bold text-slate-500 mb-1">
                      {m.senderType === "guest" ? "Khách" : m.senderType === "ai" ? `🤖 ${settings?.botName ?? "AI"}` : m.senderType === "staff" ? `👤 ${m.staff?.name ?? "Nhân viên"}` : "⚙️ Hệ thống"} · {formatVnTime(m.createdAt)}
                      {draft && " · 📝 Nháp chờ duyệt"}
                    </p>
                    {draft ? (
                      <textarea value={draftEdits[m.id] ?? m.text} onChange={(e) => setDraftEdits({ ...draftEdits, [m.id]: e.target.value })} rows={4} className="w-full min-w-[240px] bg-white rounded-lg border border-amber-200 p-2 text-base sm:text-sm" />
                    ) : (
                      <p className="text-slate-800">{m.text}</p>
                    )}
                    {m.attachments.map((a) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={a.url} src={a.url} alt={a.caption ?? "Ảnh đính kèm"} className="mt-2 w-48 rounded-lg border border-slate-200" />
                    ))}
                    {draft && (
                      <div className="flex gap-1.5 mt-2">
                        <button onClick={() => act(`messages/${m.id}/approve`, draftEdits[m.id] !== undefined ? { text: draftEdits[m.id] } : {}, "Đã gửi.")} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white">✅ Duyệt & gửi</button>
                        <button onClick={() => act(`messages/${m.id}/reject`, undefined, "Đã bỏ nháp.")} className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50">Bỏ</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {sending && <p className="text-xs text-slate-500 text-center">AI đang soạn trả lời…</p>}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-slate-200 space-y-2">
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              rows={2}
              placeholder={!conv || conv.channel === "sandbox" ? "Nhắn như khách, VD: Tối nay còn phòng Signature không ạ?" : "Trả lời khách với tư cách nhân viên…"}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm"
            />
            <div className="flex flex-wrap justify-end gap-2">
              {(!conv || conv.channel === "sandbox") && (
                <button disabled={sending || !composer.trim()} onClick={sendSandbox} className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white disabled:opacity-50">
                  Gửi như khách (Sandbox)
                </button>
              )}
              {conv && (
                <button disabled={sending || !composer.trim()} onClick={sendStaff} className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 disabled:opacity-50">
                  Trả lời với tư cách nhân viên
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Column 3 — escalations + AI trace */}
        <section className="space-y-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phiếu chờ duyệt</p>
          {escalations.length === 0 && <p className="p-3 text-xs text-slate-500 bg-white rounded-xl border border-slate-200">Không có phiếu nào cho hội thoại này.</p>}
          {escalations.map((e) => (
            <EscalationCard key={e.id} esc={e} onDone={refreshAll} />
          ))}
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pt-2">🧠 AI đang nghĩ gì</p>
          <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto">
            {runs.map((r) => (
              <li key={r.id} className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-700">{r.route === "llm" ? "LLM" : r.route.toUpperCase()} · {r.intent}</span>
                  <span className="text-slate-400">{r.latencyMs}ms · {r.neurons}n</span>
                </div>
                {r.toolCalls.map((t, i) => (
                  <p key={i} className={t.ok ? "text-slate-600" : "text-rose-700"}>
                    {t.ok ? "✓" : "✗"} {t.name}: {t.summary}
                  </p>
                ))}
                {r.ragChunks.length > 0 && <p className="text-slate-400">RAG: {r.ragChunks.join(", ")}</p>}
              </li>
            ))}
            {runs.length === 0 && <li className="p-3 text-xs text-slate-500 bg-white rounded-xl border border-slate-200">Chưa có lượt suy luận.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
