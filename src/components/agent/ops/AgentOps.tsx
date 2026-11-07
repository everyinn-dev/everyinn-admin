"use client";

/**
 * "Vận hành AI" (AI-7 W4, wireframe option A): full-screen workspace opened from Cấu hình AI.
 * Left: sections; middle: list; right: editor panel (below 1024px the panel slides over the list).
 * Every list and form comes from agent-core's master-data registry — edits apply in ~15 s without a deploy.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AgentApiError } from "@/lib/agentApi";
import { opsApi, type CollectionId, type DecisionAgg, type DelegationSuggestion, type GuestProfile, type MdRegistry, type MdRow } from "@/lib/agentOps";
import { getCachedStaffIdentity } from "@/lib/localCache";
import { useToast } from "@/components/ui/Toast";
import { ErrorBlock, Icon, ScrollRow, SkeletonRows, btn } from "./ui";
import { type OptionCtx } from "./MdForm";
import { OverviewScreen } from "./OverviewScreen";
import { ListScreen } from "./ListScreen";
import { AuthorityScreen } from "./AuthorityScreen";
import { GuestsScreen } from "./GuestsScreen";
import { ScenarioScreen } from "./flow/ScenarioScreen";

export type ScreenId = "tong-quan" | "so-luat" | "quyen" | "mau-tin" | "kich-ban" | "khung-gio" | "khach";
const SCREEN_IDS: ScreenId[] = ["tong-quan", "so-luat", "quyen", "mau-tin", "kich-ban", "khung-gio", "khach"];

export type Rows = Record<CollectionId, MdRow[]>;

export interface OpsCtx {
  registry: MdRegistry;
  rows: Rows;
  opt: OptionCtx;
  canEdit: boolean;
  myStaffId: number | null;
  /** Replace / insert one row after a save. */
  putRow: (c: CollectionId, row: MdRow) => void;
  dropRow: (c: CollectionId, id: string) => void;
  /** Switch a row on/off from a list (optimistic, version-checked). */
  toggleRow: (c: CollectionId, row: MdRow, on: boolean) => Promise<void>;
  reload: () => void;
  go: (s: ScreenId) => void;
  decisions: { summary: DecisionAgg[]; suggestions: DelegationSuggestion[] } | null;
  reloadDecisions: () => void;
  guests: GuestProfile[] | null;
  setGuests: (g: GuestProfile[] | null) => void;
}

const EMPTY_ROWS: Rows = { scenarios: [], templates: [], rules: [], authority: [], segments: [], stay_shifts: [] };

export function AgentOps() {
  const toast = useToast();
  const [screen, setScreen] = useState<ScreenId>("so-luat");
  const [registry, setRegistry] = useState<MdRegistry | null>(null);
  const [rows, setRows] = useState<Rows>(EMPTY_ROWS);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [decisions, setDecisions] = useState<OpsCtx["decisions"]>(null);
  const [guests, setGuests] = useState<GuestProfile[] | null>(null);
  const [me, setMe] = useState<{ id: number | null; manager: boolean }>({ id: null, manager: false });

  useEffect(() => {
    const s = getCachedStaffIdentity();
    setMe({ id: s?.id ?? null, manager: s?.role === "manager" });
    const q = new URLSearchParams(window.location.search).get("man") as ScreenId | null;
    if (q && SCREEN_IDS.includes(q)) setScreen(q);
  }, []);

  const go = useCallback((s: ScreenId) => {
    setScreen(s);
    const url = new URL(window.location.href);
    url.searchParams.set("man", s);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [reg, ...lists] = await Promise.all([opsApi.registry(), ...(["scenarios", "templates", "rules", "authority", "segments", "stay_shifts"] as const).map((c) => opsApi.list(c))]);
      setRegistry(reg);
      setRows({ scenarios: lists[0], templates: lists[1], rules: lists[2], authority: lists[3], segments: lists[4], stay_shifts: lists[5] });
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  const loadDecisions = useCallback(() => {
    opsApi
      .decisions(30)
      .then((d) => setDecisions({ summary: d.summary, suggestions: d.suggestions }))
      .catch(() => setDecisions({ summary: [], suggestions: [] }));
  }, []);
  useEffect(() => {
    load();
    loadDecisions();
    opsApi.guests().then(setGuests).catch(() => setGuests(null));
  }, [load, loadDecisions]);

  const putRow = useCallback((c: CollectionId, row: MdRow) => setRows((r) => ({ ...r, [c]: r[c].some((x) => x.id === row.id) ? r[c].map((x) => (x.id === row.id ? row : x)) : [...r[c], row] })), []);
  const dropRow = useCallback((c: CollectionId, id: string) => setRows((r) => ({ ...r, [c]: r[c].filter((x) => x.id !== id) })), []);
  const toggleRow = useCallback(
    async (c: CollectionId, row: MdRow, on: boolean) => {
      putRow(c, { ...row, isActive: on });
      try {
        const saved = await opsApi.update(c, row.id, { isActive: on, expectedVersion: row.version });
        putRow(c, saved);
        toast.success(on ? "Đã bật. Home dùng sau ~15 giây." : "Đã tắt. Home bỏ qua sau ~15 giây.");
      } catch (e) {
        putRow(c, row);
        if (e instanceof AgentApiError && e.status === 409) {
          toast.warning("Dòng này vừa được sửa ở nơi khác — đã tải lại.");
          opsApi.list(c).then((l) => setRows((r) => ({ ...r, [c]: l })));
        } else toast.error(e instanceof AgentApiError ? e.message : "Không đổi được.");
      }
    },
    [putRow, toast],
  );

  const opt: OptionCtx = useMemo(() => ({ scenarios: rows.scenarios, segments: rows.segments, capabilities: registry?.capabilities ?? [] }), [rows.scenarios, rows.segments, registry]);
  const ctx: OpsCtx | null = registry
    ? { registry, rows, opt, canEdit: me.manager, myStaffId: me.id, putRow, dropRow, toggleRow, reload: load, go, decisions, reloadDecisions: loadDecisions, guests, setGuests }
    : null;

  const proposals = rows.authority.filter((r) => !r.isActive && r.isSystem).length;
  const pending = proposals + (decisions?.suggestions.length ?? 0);
  const nav: Array<{ id: ScreenId; label: string; icon: string; count?: number; warn?: boolean }> = [
    { id: "tong-quan", label: "Tổng quan", icon: "layout-dashboard", count: pending, warn: true },
    { id: "so-luat", label: "Sổ luật", icon: "book-open-text", count: rows.rules.length },
    { id: "quyen", label: "Bảng quyền", icon: "shield-check", count: rows.authority.filter((r) => r.isActive).length },
    { id: "mau-tin", label: "Mẫu tin", icon: "message-square-text", count: rows.templates.length },
    { id: "kich-ban", label: "Kịch bản", icon: "route", count: rows.scenarios.length },
    { id: "khung-gio", label: "Khung giờ", icon: "clock", count: rows.stay_shifts.length },
    { id: "khach", label: "Chân dung khách", icon: "users", count: guests?.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
        <Link href="/agent-config" className={btn("ghost", "icon")} aria-label="Đóng, về Cấu hình AI" title="Đóng, về Cấu hình AI">
          <Icon name="x" className="size-5" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Link href="/agent-config" className="hidden text-slate-500 hover:text-slate-900 sm:inline">
            Cấu hình AI
          </Link>
          <Icon name="chevron-right" className="hidden size-3.5 text-slate-400 sm:inline" />
          <h1 className="truncate text-base font-bold text-slate-900">Vận hành AI</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-slate-500 lg:inline-flex">
            <Icon name="zap" className="size-3.5" />
            Sửa xong, Home dùng bản mới sau ~15 giây
          </span>
          <Link href="/agent-inbox" className={btn("outline", "sm")}>
            <Icon name="message-circle" className="size-3.5" />
            <span className="hidden sm:inline">Chat thử với Home</span>
            <span className="sm:hidden">Chat thử</span>
          </Link>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-56px)] w-[216px] shrink-0 border-r border-slate-200 bg-white p-3 md:block">
          <nav className="grid gap-1" aria-label="Vận hành AI">
            {nav.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                aria-current={screen === n.id ? "page" : undefined}
                className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm ${screen === n.id ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                <Icon name={n.icon} />
                <span className="truncate">{n.label}</span>
                {n.count != null && (n.count > 0 || !n.warn) ? (
                  <span
                    className={`ml-auto rounded-full px-1.5 text-xs font-semibold leading-5 ${n.warn ? "bg-amber-50 text-amber-800" : screen === n.id ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}
                    title={n.warn ? "Cần bạn duyệt" : undefined}
                  >
                    {n.count}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <p className="mt-4 border-t border-slate-100 px-2.5 pt-3 text-xs leading-5 text-slate-500 text-pretty">Mọi thứ ở đây là dữ liệu: thêm dòng là Home làm theo, không cần deploy.</p>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white md:hidden">
            <ScrollRow className="gap-5 px-4">
              {nav.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => go(n.id)}
                  aria-current={screen === n.id ? "page" : undefined}
                  className={`inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-1 text-sm ${screen === n.id ? "border-emerald-700 font-semibold text-slate-900" : "border-transparent font-medium text-slate-600"}`}
                >
                  {n.label}
                  {n.warn && n.count ? <span className="rounded-full bg-amber-50 px-1.5 text-xs font-semibold leading-5 text-amber-800">{n.count}</span> : null}
                </button>
              ))}
            </ScrollRow>
          </div>
          {state === "loading" || !ctx ? (
            state === "error" ? (
              <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
                <ErrorBlock what="dữ liệu vận hành" onRetry={load} />
              </div>
            ) : (
              <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-6 sm:py-6">
                <div className="h-7 w-40 animate-pulse rounded bg-slate-200/70" />
                <SkeletonRows />
              </div>
            )
          ) : screen === "tong-quan" ? (
            <OverviewScreen ctx={ctx} />
          ) : screen === "quyen" ? (
            <AuthorityScreen ctx={ctx} />
          ) : screen === "khach" ? (
            <GuestsScreen ctx={ctx} />
          ) : screen === "kich-ban" ? (
            <ScenarioScreen ctx={ctx} />
          ) : (
            <ListScreen key={screen} ctx={ctx} collection={screen === "so-luat" ? "rules" : screen === "mau-tin" ? "templates" : screen === "khung-gio" ? "stay_shifts" : "scenarios"} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Two-pane body used by every list screen: list (left) + sticky editor (right ≥1024px, sheet below). */
export function SplitLayout({ list, panel, open, onClose }: { list: React.ReactNode; panel: React.ReactNode | null; open: boolean; onClose: () => void }) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const upd = () => setNarrow(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);
  useEffect(() => {
    if (!narrow || !open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [narrow, open, onClose]);
  const show = !!panel && (narrow ? open : true);
  return (
    <div className={panel ? "lg:grid lg:grid-cols-[minmax(0,1fr)_400px]" : ""}>
      <div className="min-w-0">
        <div className={`${panel ? "max-w-none" : "max-w-6xl"} mx-auto grid grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 sm:px-6 sm:py-6`}>{list}</div>
      </div>
      {panel ? (
        <aside
          className={
            show
              ? "fixed inset-0 z-40 flex flex-col overflow-y-auto bg-white lg:sticky lg:top-14 lg:z-auto lg:h-[calc(100vh-56px)] lg:border-l lg:border-slate-200"
              : "hidden lg:sticky lg:top-14 lg:flex lg:h-[calc(100vh-56px)] lg:flex-col lg:overflow-y-auto lg:border-l lg:border-slate-200 lg:bg-white"
          }
        >
          {panel}
        </aside>
      ) : null}
    </div>
  );
}
