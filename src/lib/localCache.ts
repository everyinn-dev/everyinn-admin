/**
 * localCache.ts — Client-side localStorage cache layer with TTL support.
 *
 * Design goals (Cloudflare Free Tier optimization):
 * - Eliminate redundant fetch calls for static master data (rooms, pricingRules, configs, staff).
 * - Cache staff identity decoded from JWT to avoid hitting /api/auth/me on every page load.
 * - Persist lightweight UI preferences (dashboard viewMode, roomFilter) across sessions.
 * - All cache entries include a TTL timestamp; expired entries are silently discarded.
 *
 * Cache keys & their standard TTLs are defined in CACHE_CONFIG below.
 * Consumers should use the typed helpers: getCache / setCache / clearCache.
 */

const PREFIX = "everyinn_";

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix ms
}

// ---------------------------------------------------------------------------
// Low-level primitives
// ---------------------------------------------------------------------------

export function setCache<T>(key: string, data: T, ttlSeconds?: number): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = {
      data,
      // 0 indicates persistent cache until explicit logout or clearAllCache()
      expiresAt: ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0,
    };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage may be full or unavailable (private browsing) — silent fail
  }
}

export function getCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    // Check expiry only if expiresAt > 0 (0 means persistent until logout)
    if (entry.expiresAt && entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

/** Clears ALL everyinn_ prefixed keys (e.g. on logout or session expiration). */
export function clearAllCache(): void {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// ---------------------------------------------------------------------------
// Cache config — centralized TTLs (in seconds, 0 = persistent until logout)
// ---------------------------------------------------------------------------
export const CACHE_TTL = {
  /** Staff identity from JWT (tied dynamically to JWT expiresAt) */
  STAFF_IDENTITY: 24 * 60 * 60,
  /** Room list — persists throughout shift until staff logs out (0 = until logout) */
  ROOMS: 0,
  /** Pricing rules — persists throughout shift until staff logs out (0 = until logout) */
  PRICING_RULES: 0,
  /** Booking & hourly slot configs — persists throughout shift until staff logs out (0 = until logout) */
  CONFIGS: 0,
  /** Staff list for filter dropdowns — persists throughout shift until staff logs out (0 = until logout) */
  STAFF_LIST: 0,
} as const;

export const CACHE_KEY = {
  STAFF_IDENTITY: "staff_identity",
  ROOMS: "master_rooms",
  PRICING_RULES: "master_pricing_rules",
  CONFIGS: "master_configs",
  STAFF_LIST: "master_staff_list",
  /** Dashboard UI prefs (no TTL — use localStorage directly for these) */
  DASHBOARD_PREFS: "dashboard_prefs",
  /** Bookings list filter state (session-level, short TTL) */
  BOOKINGS_FILTER: "bookings_filter",
} as const;

// ---------------------------------------------------------------------------
// Typed helpers for master data
// ---------------------------------------------------------------------------

import type { Room, PricingRule, BookingRulesConfig } from "@/types";

export interface CachedConfigs {
  bookingRules: BookingRulesConfig;
  hourlySlots: number[];
}

export interface StaffIdentity {
  id: number;
  phone: string;
  fullName: string;
  role: string;
  expiresAt: number; // Unix ms timestamp when JWT expires
}

export interface StaffOption {
  id: number;
  full_name: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Session Expiration Event Bus
// ---------------------------------------------------------------------------
const SESSION_EXPIRED_EVENT = "everyinn:session_expired";

/**
 * Dispatches a global event notifying all listeners that the session has expired.
 * Also cleans all client-side cache immediately.
 */
export function dispatchSessionExpired(reason: string = "expired"): void {
  if (typeof window === "undefined") return;
  clearAllCache();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }));
}

/**
 * Subscribes to the session expired event. Returns an unsubscribe function.
 */
export function onSessionExpired(callback: (reason: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ reason: string }>;
    callback(customEvent.detail?.reason || "expired");
  };
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

export interface DashboardPrefs {
  viewMode: "month" | "day";
  roomFilter: "all" | "haven" | "signature";
}

export interface BookingsFilterState {
  roomId: string;
  bookingType: string;
  createdBy: string;
  createdFrom: string;
  createdTo: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}

// --- Rooms ---
export const getCachedRoomsClient = (): Room[] | null =>
  getCache<Room[]>(CACHE_KEY.ROOMS);

export const setCachedRoomsClient = (rooms: Room[]): void =>
  setCache(CACHE_KEY.ROOMS, rooms, CACHE_TTL.ROOMS);

// --- Pricing Rules ---
export const getCachedPricingRulesClient = (): PricingRule[] | null =>
  getCache<PricingRule[]>(CACHE_KEY.PRICING_RULES);

export const setCachedPricingRulesClient = (rules: PricingRule[]): void =>
  setCache(CACHE_KEY.PRICING_RULES, rules, CACHE_TTL.PRICING_RULES);

// --- Configs ---
export const getCachedConfigsClient = (): CachedConfigs | null =>
  getCache<CachedConfigs>(CACHE_KEY.CONFIGS);

export const setCachedConfigsClient = (configs: CachedConfigs): void =>
  setCache(CACHE_KEY.CONFIGS, configs, CACHE_TTL.CONFIGS);

// --- Staff Identity (from JWT /api/auth/me) ---
export const getCachedStaffIdentity = (): StaffIdentity | null =>
  getCache<StaffIdentity>(CACHE_KEY.STAFF_IDENTITY);

export const setCachedStaffIdentity = (staff: StaffIdentity): void => {
  const remainingSeconds = staff.expiresAt
    ? Math.max(1, Math.floor((staff.expiresAt - Date.now()) / 1000))
    : CACHE_TTL.STAFF_IDENTITY;
  setCache(CACHE_KEY.STAFF_IDENTITY, staff, remainingSeconds);
};

// --- Staff List (for filter dropdowns) ---
export const getCachedStaffList = (): StaffOption[] | null =>
  getCache<StaffOption[]>(CACHE_KEY.STAFF_LIST);

export const setCachedStaffList = (list: StaffOption[]): void =>
  setCache(CACHE_KEY.STAFF_LIST, list, CACHE_TTL.STAFF_LIST);

// --- Dashboard UI preferences (no TTL — use setItem directly, no expiry) ---
export const getDashboardPrefs = (): DashboardPrefs | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + CACHE_KEY.DASHBOARD_PREFS);
    if (!raw) return null;
    return JSON.parse(raw) as DashboardPrefs;
  } catch {
    return null;
  }
};

export const setDashboardPrefs = (prefs: DashboardPrefs): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + CACHE_KEY.DASHBOARD_PREFS, JSON.stringify(prefs));
  } catch {}
};

// --- Bookings filter state (short TTL: 30 min session persistence) ---
export const getBookingsFilterState = (): BookingsFilterState | null =>
  getCache<BookingsFilterState>(CACHE_KEY.BOOKINGS_FILTER);

export const setBookingsFilterState = (state: BookingsFilterState): void =>
  setCache(CACHE_KEY.BOOKINGS_FILTER, state, 30 * 60); // 30 min
