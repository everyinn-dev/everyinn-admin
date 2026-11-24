"use client";

import React from "react";
import { COLLECTION_OPTIONS, type CollectionMode, type PaymentMethod } from "@/lib/bookingCollection";
import { REFUND_METHODS } from "@/lib/bookingClosure";

interface CollectionSectionProps {
  mode: CollectionMode;
  onChangeMode: (mode: CollectionMode) => void;
  method: PaymentMethod;
  onChangeMethod: (method: PaymentMethod) => void;
}

/**
 * "Đã thu tiền chưa?" — staff state what actually arrived (EI-FINANCE-ONTOLOGY-001 invariant 8).
 * Nothing is recorded as paid unless staff pick it here.
 */
export const CollectionSection: React.FC<CollectionSectionProps> = ({ mode, onChangeMode, method, onChangeMethod }) => {
  const active = COLLECTION_OPTIONS.find((o) => o.value === mode);
  // "Đặt cọc" is driven only by the deposit switch in DepositSection (same state), so it is not offered as a button here.
  const buttonOptions = COLLECTION_OPTIONS.filter((o) => o.value !== "deposit");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="p-4 space-y-3">
        <div>
          <span className="text-sm font-bold text-slate-900 block leading-tight">Thu tiền khi tạo đơn</span>
          <span className="text-[11px] text-slate-500">Chỉ ghi nhận số tiền khách đã thực trả.</span>
        </div>
        <div role="radiogroup" aria-label="Trạng thái thu tiền" className="grid grid-cols-3 gap-2">
          {buttonOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={mode === o.value}
              onClick={() => onChangeMode(o.value)}
              className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                mode === o.value ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {active && <p className="text-[11px] text-slate-500">{active.hint}</p>}
        {mode !== "none" && (
          <label className="block space-y-1">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Phương thức thanh toán</span>
            <select
              value={method}
              onChange={(e) => onChangeMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-600"
            >
              {REFUND_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
};
