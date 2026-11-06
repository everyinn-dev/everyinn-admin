"use client";

/**
 * Small building blocks of "Vận hành AI" (AI-7 W4). Classes are copied from the approved wireframe (gate 2, option A).
 * Icons: lucide (ISC) path data inlined — the admin has no icon dependency.
 */
import React, { useEffect, useRef, useState } from "react";

const ICONS: Record<string, React.ReactNode> = {
  x: (<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>),
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  zap: <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
  "message-circle": <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  "layout-dashboard": (<><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>),
  "book-open-text": (<><path d="M12 7v14" /><path d="M16 12h2" /><path d="M16 8h2" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /><path d="M6 12h2" /><path d="M6 8h2" /></>),
  "shield-check": (<><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>),
  "message-square-text": (<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M13 8H7" /><path d="M17 12H7" /></>),
  route: (<><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></>),
  users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  search: (<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
  plus: (<><path d="M5 12h14" /><path d="M12 5v14" /></>),
  "eye-off": (<><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" /></>),
  "arrow-left": (<><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>),
  lock: (<><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  shuffle: (<><path d="m18 14 4 4-4 4" /><path d="m18 2 4 4-4 4" /><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" /><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" /><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" /></>),
  gavel: (<><path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" /><path d="m16 16 6-6" /><path d="m8 8 6-6" /><path d="m9 7 8 8" /><path d="m21 11-8-8" /></>),
  bot: (<><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></>),
  "user-check": (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></>),
  ban: (<><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></>),
  sparkles: (<><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></>),
  "rotate-cw": (<><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></>),
  "trash-2": (<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></>),
  check: <path d="M20 6 9 17l-5-5" />,
  // AI-9 Truy vết AI
  "user-round": (<><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></>),
  history: (<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>),
  "id-card": (<><path d="M16 10h2" /><path d="M16 14h2" /><path d="M6.17 15a3 3 0 0 1 5.66 0" /><circle cx="9" cy="11" r="2" /><rect x="2" y="5" width="20" height="14" rx="2" /></>),
  split: (<><path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" /></>),
  "shopping-bag": (<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>),
  "file-text": (<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></>),
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  "shield-alert": (<><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" /></>),
  "layout-template": (<><rect width="18" height="7" x="3" y="3" rx="1" /><rect width="9" height="7" x="3" y="14" rx="1" /><rect width="5" height="7" x="16" y="14" rx="1" /></>),
  send: (<><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></>),
  "triangle-alert": (<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>),
  copy: (<><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>),
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "list-tree": (<><path d="M21 12h-8" /><path d="M21 6H8" /><path d="M21 18h-8" /><path d="M3 6v4c0 1.1.9 2 2 2h3" /><path d="M3 10v6c0 1.1.9 2 2 2h3" /></>),
  "circle-x": (<><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></>),
};

export function Icon({ name, className = "size-4" }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// ── shared class strings (wireframe tokens: slate surfaces, emerald-700 primary) ──
export const cls = {
  card: "rounded-2xl border border-[#e8edf3] bg-white",
  fld: "w-full rounded-lg border border-slate-300 bg-white px-3 text-base sm:text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-700/15 disabled:bg-slate-50 disabled:text-slate-600",
  input: "h-10",
  area: "py-2 leading-6 resize-y",
  lbl: "text-xs font-semibold text-slate-600",
  help: "text-xs text-slate-500 text-pretty",
  btn: "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap select-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs gap-1.5",
  primary: "bg-emerald-700 text-white font-semibold hover:bg-emerald-800",
  outline: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 hover:border-slate-400",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  icon: "h-9 w-9 px-0",
  row: "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700",
  rowSel: "bg-emerald-50 shadow-[inset_3px_0_0_#047857] hover:bg-emerald-50",
};

export const btn = (variant: "primary" | "outline" | "ghost", size: "md" | "sm" | "icon" = "md") => `${cls.btn} ${cls[size === "icon" ? "icon" : size]} ${cls[variant]}`;

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-emerald-700" : "bg-slate-300"}`}
    >
      <span className={`absolute left-0.5 size-5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/.2)] transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

export function Seg<T extends string>({ options, value, onChange, disabled, label }: { options: Array<[T, string]>; value: T | undefined; onChange: (v: T) => void; disabled?: boolean; label?: string }) {
  return (
    <div role="group" aria-label={label} className={`${options.length >= 4 ? "grid grid-cols-2" : "inline-flex flex-wrap"} gap-1 rounded-xl bg-slate-100 p-1`}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`h-8 rounded-lg px-3 text-xs ${v === value ? "bg-white font-semibold text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/.08),0_0_0_1px_rgb(15_23_42/.05)]" : "font-medium text-slate-600 hover:text-slate-900"} disabled:cursor-not-allowed`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Chips({ options, value, onChange, disabled }: { options: Array<[string, string]>; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const min = Math.max(76, Math.max(0, ...options.map(([, l]) => l.length)) * 7.5 + 30);
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${min}px,1fr))` }}>
      {options.map(([v, l]) => {
        const on = value.includes(v);
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])}
            className={`inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium disabled:cursor-not-allowed ${on ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

/** Custom listbox (no native <select>): button + popover, closes on outside click / Esc. */
export function Dropdown({ options, value, onChange, disabled, placeholder = "Chọn", label }: { options: Array<[string, string]>; value: string | undefined; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const cur = options.find(([v]) => v === value)?.[1];
  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)} className={`${cls.fld} ${cls.input} flex items-center justify-between gap-2 text-left`}>
        <span className={`min-w-0 truncate ${cur ? "" : "text-slate-500"}`}>{cur ?? placeholder}</span>
        <Icon name="chevron-down" className="size-4 text-slate-500" />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 top-full z-30 mt-1 grid max-h-72 min-w-full gap-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgb(15_23_42/.08)]">
          {options.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={v === value}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
              className={`flex h-9 items-center rounded-lg px-2.5 text-left text-sm hover:bg-slate-100 ${v === value ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Field({ label, help, children, as = "label" }: { label: string; help?: React.ReactNode; children: React.ReactNode; as?: "label" | "div" }) {
  const Tag = as;
  return (
    <Tag className="grid min-w-0 gap-1.5">
      <span className={cls.lbl}>{label}</span>
      {children}
      {help ? <span className={cls.help}>{help}</span> : null}
    </Tag>
  );
}

export const Tag = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "brand" | "warn" }) => (
  <span className={`inline-flex h-5 items-center whitespace-nowrap rounded-md px-1.5 text-xs font-semibold ${tone === "brand" ? "bg-emerald-50 text-emerald-800" : tone === "warn" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{children}</span>
);

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full shrink-0 sm:w-56">
      <span className="sr-only">{placeholder}</span>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
      <input className={`${cls.fld} ${cls.input} pl-9`} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Horizontal chip row that fades the edge where more items hide. */
export function ScrollRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => setMore((el.scrollLeft > 2 ? "l" : "") + (el.scrollLeft + el.clientWidth < el.scrollWidth - 2 ? "r" : ""));
    upd();
    el.addEventListener("scroll", upd, { passive: true });
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", upd);
      ro.disconnect();
    };
  }, []);
  const mask =
    more === "r"
      ? "linear-gradient(to right,#000 calc(100% - 32px),transparent)"
      : more === "l"
        ? "linear-gradient(to left,#000 calc(100% - 32px),transparent)"
        : more === "lr"
          ? "linear-gradient(to right,transparent,#000 32px,#000 calc(100% - 32px),transparent)"
          : undefined;
  return (
    <div ref={ref} className={`flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`} style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
      {children}
    </div>
  );
}

export function FilterChip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium ${active ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}>
      {children}
      {count != null && <span className={active ? "text-emerald-800/80" : "text-slate-500"}>{count}</span>}
    </button>
  );
}

export function SkeletonRows({ n = 7 }: { n?: number }) {
  return (
    <div className={`${cls.card} divide-y divide-slate-100`} aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="h-4 w-10 animate-pulse rounded bg-slate-200/70" />
          <div className="grid flex-1 gap-2">
            <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200/70" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200/70" />
          </div>
          <div className="h-6 w-11 animate-pulse rounded-full bg-slate-200/70" />
        </div>
      ))}
    </div>
  );
}

export const EmptyLine = ({ children }: { children: React.ReactNode }) => (
  <div className={cls.card}>
    <p className="py-6 text-center text-sm text-slate-500">{children}</p>
  </div>
);

export function ErrorBlock({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className={`${cls.card} flex flex-col items-center gap-3 py-8 text-center`}>
      <p className="text-sm text-slate-700">Không tải được {what}. Kiểm tra kết nối rồi thử lại.</p>
      <button type="button" className={btn("outline", "sm")} onClick={onRetry}>
        <Icon name="rotate-cw" className="size-3.5" />
        Thử lại
      </button>
    </div>
  );
}

export function ScreenHead({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 text-pretty">{desc}</p>
      </div>
      {action}
    </div>
  );
}

export function PanelHead({ code, title, sub, onBack }: { code?: string; title: string; sub?: string; onBack: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
      <button type="button" className={`${btn("ghost", "icon")} -ml-2 lg:hidden`} onClick={onBack} aria-label="Quay lại">
        <Icon name="arrow-left" className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        {code ? <p className="font-mono text-xs font-semibold text-slate-500">{code}</p> : null}
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
      </div>
    </div>
  );
}

export function PanelFooter({ by, line, note, dirty, saving, canEdit, onCancel, onSave, onDelete }: { by: string; line?: string; note: string; dirty: boolean; saving: boolean; canEdit: boolean; onCancel: () => void; onSave: () => void; onDelete?: () => void }) {
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3">
      <span className="min-w-0 flex-1 text-xs text-slate-500">
        {line ?? `Sửa bởi ${by}`}
        <span className="block">{canEdit ? note : "Bạn chỉ xem được — quản lí mới sửa."}</span>
      </span>
      {canEdit && onDelete ? (
        <button type="button" className={btn("ghost", "icon")} onClick={onDelete} aria-label="Xoá dòng này" title="Xoá dòng này">
          <Icon name="trash-2" className="size-4 text-rose-700" />
        </button>
      ) : null}
      {canEdit ? (
        <>
          <button type="button" className={btn("ghost")} onClick={onCancel} disabled={!dirty || saving}>
            Huỷ
          </button>
          <button type="button" className={btn("primary")} onClick={onSave} disabled={!dirty || saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      ) : null}
    </div>
  );
}
