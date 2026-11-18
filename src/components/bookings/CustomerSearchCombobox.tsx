"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import type { Member } from "@/types";
import { apiFetch } from "@/lib/apiClient";
import { highlightSegments, maskNational, queryTokens } from "@/lib/guestAutofill";
import { Badge } from "../ui/Badge";

export interface CustomerSearchHit {
  customerId: string;
  matchedField: "facebook" | "instagram" | "zalo" | "name" | "phone" | null;
  matchedValue: string | null;
  lastBookingAt: string | null;
  lastRoomClass: string | null;
  member: Member;
}

interface Props {
  /** Profile currently filled into the form (from this dropdown or the phone lookup). */
  selected: Member | null;
  onSelect: (member: Member) => void;
  /** "Đã điền từ hồ sơ X · Hoàn tác" after a refill. */
  undoLabel?: string | null;
  onUndo?: () => void;
}

const DEBOUNCE_MS = 250;

const CHANNEL: Record<NonNullable<CustomerSearchHit["matchedField"]>, { icon: string; label: string; cls: string }> = {
  facebook: { icon: "f", label: "FB", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  instagram: { icon: "◎", label: "IG", cls: "bg-pink-50 text-pink-700 border-pink-200" },
  zalo: { icon: "Z", label: "Zalo", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  name: { icon: "👤", label: "Tên", cls: "bg-slate-50 text-slate-600 border-slate-200" },
  phone: { icon: "☎", label: "SĐT", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function formatVnDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
}

function roomLabel(rc: string | null): string | null {
  if (!rc) return null;
  return rc.charAt(0).toUpperCase() + rc.slice(1);
}

function Highlighted({ value, tokens }: { value: string; tokens: string[] }) {
  return (
    <>
      {highlightSegments(value, tokens).map((s, i) =>
        s.hit ? (
          <mark key={i} className="bg-amber-100 text-slate-900 rounded-sm px-0">
            {s.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * Returning-guest search by Facebook / Instagram / Zalo name, full name or phone prefix (CDP FTS).
 * Each row shows the matched social name plus the last booking, masked phone and visit count so two
 * guests with the same name can be told apart.
 */
export const CustomerSearchCombobox: React.FC<Props> = ({ selected, onSelect, undoLabel, onUndo }) => {
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<CustomerSearchHit[]>([]);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const tokens = queryTokens(q);
  const searchable = tokens.join("").length >= 2;

  useEffect(() => {
    abortRef.current?.abort();
    // Below 2 characters nothing is fetched and the list is hidden (showList), so no state reset is needed.
    if (!searchable) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/members/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { results?: CustomerSearchHit[]; error?: string };
        if (ctrl.signal.aborted) return;
        if (!res.ok) throw new Error(data.error || "Không tìm được khách.");
        setHits(data.results ?? []);
        setActive(0);
      } catch (e) {
        if ((e as Error).name === "AbortError" || ctrl.signal.aborted) return;
        setHits([]);
        setError((e as Error).message || "Không tìm được khách.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, searchable]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (h: CustomerSearchHit) => {
    onSelect(h.member);
    setQ("");
    setHits([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && hits[active]) {
        e.preventDefault();
        pick(hits[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && searchable;
  const selectedName = selected ? selected.fullName || selected.full_name || "Khách quen" : null;

  return (
    <div className="space-y-1.5" ref={boxRef}>
      <label htmlFor={`${listId}-input`} className="block text-xs font-bold text-slate-700 tracking-wide uppercase">
        Tìm khách quen (tên FB / IG / Zalo, họ tên hoặc SĐT)
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔎</span>
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Gõ vài chữ, ví dụ: ngoc tram, ngoctram.99, 0912…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl bg-white border border-slate-300 pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 shadow-2xs"
        />
        {loading && searchable && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs animate-spin">⏳</span>}

        {showList && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            className="absolute z-30 mt-1 w-full max-h-96 overflow-auto rounded-xl bg-white border border-slate-200 shadow-lg divide-y divide-slate-100"
          >
            {error && <li className="px-3 py-2.5 text-xs text-rose-700">{error}</li>}
            {!error && !loading && hits.length === 0 && (
              <li className="px-3 py-2.5 text-xs text-slate-500">Không có khách nào khớp. Khách mới — nhập SĐT bên dưới.</li>
            )}
            {hits.map((h, i) => {
              const m = h.member;
              const field = h.matchedField ?? "name";
              const ch = CHANNEL[field];
              const fullName = m.fullName || m.full_name || "";
              const primary = h.matchedValue || fullName || m.phone;
              const showFullName = fullName && h.matchedField !== "name" && fullName !== primary;
              const last = formatVnDate(h.lastBookingAt);
              const room = roomLabel(h.lastRoomClass);
              const isSelected = selected?.customerId === h.customerId;
              return (
                <li
                  key={h.customerId}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(h);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`px-3 py-2 cursor-pointer space-y-0.5 ${i === active ? "bg-emerald-50" : "bg-white"}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${ch.cls}`}>
                      {ch.icon} {ch.label}
                    </span>
                    <span className="font-semibold text-sm text-slate-900 truncate">
                      <Highlighted value={primary} tokens={tokens} />
                    </span>
                    {showFullName && <span className="text-xs text-slate-500 truncate">· {fullName}</span>}
                    {isSelected && <span className="ml-auto shrink-0 text-[10px] font-semibold text-emerald-700">Đang dùng</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                    <span className="font-medium text-slate-700">{last ? `Gần nhất ${last}` : "Chưa có lần đặt được ghi nhận"}</span>
                    {room && <span>· {room}</span>}
                    <span className="font-mono">· {maskNational(m.phone)}</span>
                    <span>· {m.totalBookings ?? 0} lần</span>
                    <Badge tier={m.loyaltyTier || "new"} size="sm" />
                    {(m.noShowCount ?? 0) > 0 && (
                      <span className="px-1.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-semibold">No-show {m.noShowCount}</span>
                    )}
                    {m.isBlocked === 1 && <span className="px-1.5 rounded bg-rose-600 text-white font-semibold">Bị chặn</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedName && (
        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5">
          <span>
            {undoLabel ? "Đã điền từ hồ sơ" : "Đang dùng hồ sơ"}: <strong className="text-slate-900">{selectedName}</strong>
            {selected?.phone && <span className="font-mono"> · {selected.phone}</span>}
          </span>
          {undoLabel && onUndo && (
            <button type="button" onClick={onUndo} className="text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2">
              Hoàn tác
            </button>
          )}
        </div>
      )}
      {!selectedName && undoLabel && onUndo && (
        <div className="text-[11px] text-slate-600">
          <button type="button" onClick={onUndo} className="text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2">
            Hoàn tác lần điền trước
          </button>
        </div>
      )}
    </div>
  );
};
