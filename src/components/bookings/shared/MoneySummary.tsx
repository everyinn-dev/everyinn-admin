"use client";

import React from "react";

export interface MoneyRow {
  label: string;
  value: number;
  /** emphasise (the figure the receptionist must act on) */
  strong?: boolean;
  tone?: "default" | "good" | "bad";
  /** show a leading "+" / "−" */
  signed?: boolean;
}

const vnd = (n: number) => `${Math.round(Math.abs(n)).toLocaleString("vi-VN")}đ`;
const TONE = { default: "text-slate-800", good: "text-emerald-800", bad: "text-rose-700" } as const;

/** Label / amount rows — the money block of the cancel, charge and void panels. */
export const MoneySummary: React.FC<{ rows: MoneyRow[] }> = ({ rows }) => (
  <dl className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1">
    {rows.map((r) => (
      <div key={r.label} className={`flex justify-between gap-3 ${r.strong ? "pt-1 mt-1 border-t border-slate-200 font-bold" : ""}`}>
        <dt className="text-slate-600">{r.label}</dt>
        <dd className={`font-mono ${r.strong ? "font-extrabold" : "font-bold"} ${TONE[r.tone ?? "default"]}`}>
          {r.signed ? (r.value < 0 ? "−" : "+") : ""}
          {vnd(r.value)}
        </dd>
      </div>
    ))}
  </dl>
);
