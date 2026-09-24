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
          <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase">
            {label}
            {props.required && <span className="text-rose-400 ml-1">*</span>}
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
            className={`w-full rounded-xl bg-[#131b28] border border-slate-700/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-all duration-150 focus:border-emerald-500 focus:bg-[#162234] focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? "pl-10" : ""
            } ${rightElement ? "pr-12" : ""} ${
              error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center">{rightElement}</div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <span>⚠</span> {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-slate-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
