"use client";

import React, { useId } from "react";

interface ReasonFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}

/** One-line reason / note input with a real label (the same field in the cancel, charge and void panels). */
export const ReasonField: React.FC<ReasonFieldProps> = ({ label, value, onChange, required, placeholder, maxLength = 500 }) => {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[11px] font-bold text-slate-700">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      <input
        id={id}
        type="text"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
      />
    </div>
  );
};
