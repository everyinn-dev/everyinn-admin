import React, { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightElement, className = "", ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-bold text-slate-700 tracking-wide uppercase">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 pointer-events-none text-slate-400 flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all duration-150 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed shadow-2xs ${
              leftIcon ? "pl-10" : ""
            } ${rightElement ? "pr-12" : ""} ${
              error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : ""
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center">{rightElement}</div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
            <span>⚠</span> {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
