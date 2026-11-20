"use client";

import React from "react";
import { clampCollect } from "@/lib/charges";
import type { SettleSlot } from "@/lib/editPricing";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/ledger";

/** State of one "settle in the same step" option: ticked or not, what staff typed (if anything), how the money moves. */
export interface MoneyMove {
  on: boolean;
  amount: number;
  /** Staff typed an amount: stop following the default. */
  touched: boolean;
  method: PaymentMethod;
}

export const initialMove = (on: boolean): MoneyMove => ({ on, amount: 0, touched: false, method: "cash" });

/** The amount that will be recorded: 0 when the option is unavailable / unticked, else typed-or-default, within the cap. */
export function moveAmount(move: MoneyMove, slot: SettleSlot): number {
  if (!slot.available || !move.on) return 0;
  return clampCollect(move.touched ? move.amount : slot.defaultAmount, slot.max);
}

const vnd = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString("vi-VN")}đ`;

interface MoneyMoveFieldProps {
  id: string;
  /** "Khách trả thêm ngay" / "Hoàn lại khách ngay" */
  label: string;
  amountLabel: string;
  /** Shown when unticked: what will be left open. */
  offHint: string;
  slot: SettleSlot;
  move: MoneyMove;
  onChange: (next: MoneyMove) => void;
}

/**
 * "Settle in the same step" block (EI-FINANCE-ONTOLOGY-001 §8): the money of a price change is recorded together with
 * the change instead of in a second step. Used by the stay edit form and by voiding a charge.
 */
export const MoneyMoveField: React.FC<MoneyMoveFieldProps> = ({ id, label, amountLabel, offHint, slot, move, onChange }) => {
  if (!slot.available) return null;
  const shown = move.touched ? move.amount || "" : slot.defaultAmount;
  return (
    <div className="space-y-2 bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-800 cursor-pointer">
        <input type="checkbox" className="accent-emerald-600" checked={move.on} onChange={(e) => onChange({ ...move, on: e.target.checked })} />
        {label}
      </label>
      {move.on ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor={`${id}-amount`} className="block text-[11px] font-bold text-slate-700">
              {amountLabel}
            </label>
            <input
              id={`${id}-amount`}
              type="number"
              min={1}
              max={slot.max}
              step={1000}
              value={shown}
              onChange={(e) => onChange({ ...move, touched: true, amount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-method`} className="block text-[11px] font-bold text-slate-700">
              Phương thức
            </label>
            <select
              id={`${id}-method`}
              value={move.method}
              onChange={(e) => onChange({ ...move, method: e.target.value as PaymentMethod })}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-amber-800">{offHint}</p>
      )}
      {move.on && move.touched && move.amount > slot.max && <p className="text-[11px] text-amber-800">Tối đa {vnd(slot.max)}.</p>}
    </div>
  );
};
