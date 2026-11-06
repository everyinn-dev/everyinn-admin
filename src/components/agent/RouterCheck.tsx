"use client";

/**
 * AI-11 "Kiểm tra Điều phối": runs the agent-core router on its built-in check set (real guest lines, anonymised)
 * in batches of 10 and shows how often it understood correctly — the owner decides "Bật" from this table.
 */
import React, { useState } from "react";
import { agentApi, AgentApiError, type AgentResult } from "@/lib/agentApi";
import { ACT_LABEL } from "@/lib/agentOps";

interface CaseResult {
  id: string;
  note?: string;
  burst: string;
  expect: { act: string; scenario?: string | null; slots?: Record<string, unknown> };
  got: { act: string; scenario: string | null; confidence: number; slots: Record<string, unknown>; reason: string } | null;
  error: string | null;
  ms: number;
  neurons: number;
  ok: { act: boolean; scenario: boolean | null; slots: { hit: number; of: number } | null };
}

interface EvalBatch {
  model: string;
  total: number;
  next: number | null;
  results: CaseResult[];
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export function RouterCheck({ model }: { model: string | null }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<CaseResult[]>([]);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setResults([]);
    setError(null);
    setDone(0);
    let offset: number | null = 0;
    const all: CaseResult[] = [];
    try {
      while (offset !== null) {
        const res: AgentResult<EvalBatch> = await agentApi<EvalBatch>("router/eval", { method: "POST", body: { offset, model } });
        if (!res.data) break;
        all.push(...res.data.results);
        setResults([...all]);
        setTotal(res.data.total);
        setDone(all.length);
        setUsedModel(res.data.model);
        offset = res.data.next;
      }
    } catch (e) {
      setError(e instanceof AgentApiError ? e.message : "Không chạy được kiểm tra.");
    } finally {
      setRunning(false);
    }
  };

  const n = results.length;
  const actOk = results.filter((r) => r.ok.act).length;
  const sc = results.filter((r) => r.ok.scenario !== null);
  const scOk = sc.filter((r) => r.ok.scenario).length;
  const slotOf = results.reduce((a, r) => a + (r.ok.slots?.of ?? 0), 0);
  const slotHit = results.reduce((a, r) => a + (r.ok.slots?.hit ?? 0), 0);
  const bad = results.filter((r) => !r.got).length;
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const q = (p: number) => (times.length ? times[Math.min(times.length - 1, Math.floor(p * times.length))] : 0);
  const neurons = results.reduce((a, r) => a + r.neurons, 0);
  const misses = results.filter((r) => !r.ok.act || r.ok.scenario === false || (r.ok.slots && r.ok.slots.hit < r.ok.slots.of));
  const pass = n > 0 && actOk / n >= 0.9 && (!slotOf || slotHit / slotOf >= 0.85) && q(0.95) < 2500;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">Kiểm tra trên tin khách mẫu</p>
          <p className="text-[11px] text-slate-500">≈40 tin thật đã che tên/SĐT (cả các ca từng lỗi). Tốn khoảng 30 neuron mỗi tin.</p>
        </div>
        <button type="button" disabled={running} onClick={run} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
          {running ? `Đang chạy ${done}/${total || "…"}` : n ? "Chạy lại" : "Kiểm tra"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-700">{error}</p>}
      {n > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Hiểu đúng ý khách", pct(actOk, n), `${actOk}/${n}`],
              ["Chọn đúng kịch bản", pct(scOk, sc.length), `${scOk}/${sc.length}`],
              ["Đúng ngày giờ / phòng", pct(slotHit, slotOf), `${slotHit}/${slotOf}`],
              ["95% lượt dưới", `${(q(0.95) / 1000).toFixed(1).replace(".", ",")} s`, `JSON lỗi ${bad} · ${neurons} neuron`],
            ].map(([l, v, s]) => (
              <div key={l} className="rounded-lg border border-slate-200 bg-white p-2">
                <p className="text-[11px] text-slate-500">{l}</p>
                <p className="text-lg font-black tabular-nums text-slate-900">{v}</p>
                <p className="text-[11px] tabular-nums text-slate-500">{s}</p>
              </div>
            ))}
          </div>
          {!running && (
            <p className={`text-xs font-semibold ${pass ? "text-emerald-700" : "text-amber-700"}`}>
              {pass ? `✅ Đạt ngưỡng (ý ≥ 90%, ngày giờ ≥ 85%, 95% lượt < 2,5 s) với ${usedModel} — có thể chuyển sang “Bật”.` : `⚠️ Chưa đạt ngưỡng (ý ≥ 90%, ngày giờ ≥ 85%, 95% lượt < 2,5 s) — giữ “Chạy thử”.`}
            </p>
          )}
          {misses.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="text-[11px] text-slate-500">
                  <tr>
                    <th className="py-1 pr-2 font-semibold">Tin khách</th>
                    <th className="py-1 pr-2 font-semibold">Đúng ra</th>
                    <th className="py-1 font-semibold">AI hiểu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {misses.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="py-1.5 pr-2 text-slate-800">
                        “{r.burst}”<span className="block text-[11px] text-slate-400">{r.note}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-slate-700">
                        {ACT_LABEL[r.expect.act] ?? r.expect.act}
                        {r.expect.scenario ? ` · ${r.expect.scenario}` : ""}
                        {r.expect.slots ? <span className="block text-[11px] text-slate-500">{Object.entries(r.expect.slots).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</span> : null}
                      </td>
                      <td className="py-1.5 text-slate-700">
                        {r.got ? (
                          <>
                            {ACT_LABEL[r.got.act] ?? r.got.act}
                            {r.got.scenario ? ` · ${r.got.scenario}` : ""} · {Math.round(r.got.confidence * 100)}%
                            <span className="block text-[11px] text-slate-500">{r.got.reason}</span>
                          </>
                        ) : (
                          <span className="text-rose-700">Lỗi: {r.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
