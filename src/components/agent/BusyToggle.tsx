"use client";

import React, { useState } from "react";
import { agentApi, AgentApiError, formatVnTime, type AgentSettings } from "@/lib/agentApi";
import { useToast } from "@/components/ui/Toast";

/** Quick busy switch (shared by /agent-inbox and /agent-config). Same endpoint as Telegram `/busy 2h`. */
export function BusyToggle({ settings, onChange }: { settings: AgentSettings | null; onChange: (s: AgentSettings) => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  if (!settings) return null;
  const busy = settings.busy;

  const set = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await agentApi<{ settings: AgentSettings }>("settings/busy", { method: "POST", body });
      if (res.data) onChange(res.data.settings);
      toast.success(body.off ? "Đã tắt giờ bận thủ công." : "Đã bật giờ bận.");
    } catch (e) {
      toast.error(e instanceof AgentApiError ? e.message : "Không đổi được giờ bận.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`p-3 rounded-xl border shadow-2xs space-y-2 ${busy.active ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-700">
          {busy.active ? (busy.reason === "manual" ? "⏸️ Đang bận" : "🌙 Giờ nghỉ đêm") : "☀️ Đang trực"}
          {busy.active && busy.until && <span className="font-medium text-slate-500"> đến {formatVnTime(busy.until)}</span>}
        </p>
        {settings.quietHours.enabled && (
          <span className="text-[10px] text-slate-500 whitespace-nowrap">
            Tự động {settings.quietHours.start}–{settings.quietHours.end}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[60, 120, 240].map((m) => (
          <button key={m} disabled={saving} onClick={() => set({ minutes: m })} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50">
            Bận {m / 60}h
          </button>
        ))}
        {settings.busyUntil && (
          <button disabled={saving} onClick={() => set({ off: true })} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 disabled:opacity-50">
            Tắt bận
          </button>
        )}
      </div>
    </div>
  );
}
