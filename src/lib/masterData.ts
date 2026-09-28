import {
  BookingRulesConfig,
  CdpTiersConfig,
  HourlySlotsConfig,
  PricingRule,
  Promotion,
  PromotionCategory,
  Room,
} from "@/types";
import { getOrSet, invalidatePrefix } from "./cache";

export const MASTER_DATA_TTL = 3600; // 60 minutes in seconds

export const DEFAULT_BOOKING_RULES: BookingRulesConfig = {
  min_hourly: 3,
  max_hourly_checkin: "21:00",
  overnight_start: "21:00",
  overnight_max_checkout: "09:00",
  day_checkin: "15:00",
  day_checkout: "12:00",
  max_late_checkout_hours: 2,
  extra_hour_fee: 60000,
};

export const DEFAULT_CDP_TIERS: CdpTiersConfig = {
  bronze: { min_spent: 500000, min_bookings: 1 },
  silver: { min_spent: 3000000, min_bookings: 5 },
  gold: { min_spent: 8000000, min_bookings: 10 },
};

export const DEFAULT_HOURLY_SLOTS: number[] = [21, 22, 23, 24];

/**
 * Get active rooms list cached for 60 minutes
 */
export async function getCachedRooms(db: D1Database): Promise<Room[]> {
  return getOrSet("master:rooms", MASTER_DATA_TTL, async () => {
    const { results } = await db
      .prepare(
        `SELECT id, property_id, room_number, name, room_class, floor, area_sqm, max_guests, sort_order, is_active
         FROM rooms
         WHERE is_active = 1
         ORDER BY sort_order ASC, room_number ASC`
      )
      .all<Room>();
    return results || [];
  });
}

/**
 * Get active pricing rules list cached for 60 minutes
 */
export async function getCachedPricingRules(db: D1Database): Promise<PricingRule[]> {
  return getOrSet("master:pricing_rules", MASTER_DATA_TTL, async () => {
    const { results } = await db
      .prepare(
        `SELECT id, property_id, room_class, booking_type, base_price, extra_hour_fee, is_active
         FROM pricing_rules
         WHERE is_active = 1`
      )
      .all<PricingRule>();
    return results || [];
  });
}

/**
 * Get booking rules config from D1 cached for 60 minutes
 */
export async function getCachedBookingRules(db: D1Database): Promise<BookingRulesConfig> {
  return getOrSet("master:booking_rules", MASTER_DATA_TTL, async () => {
    const row = await db
      .prepare("SELECT value FROM configs WHERE key = 'booking_rules' LIMIT 1")
      .first<{ value: string }>();

    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value) as Partial<BookingRulesConfig>;
        return { ...DEFAULT_BOOKING_RULES, ...parsed };
      } catch (e) {
        console.error("Failed to parse booking_rules config JSON:", e);
      }
    }
    return DEFAULT_BOOKING_RULES;
  });
}

/**
 * Get CDP tier thresholds from D1 cached for 60 minutes
 */
export async function getCachedCdpTiers(db: D1Database): Promise<CdpTiersConfig> {
  return getOrSet("master:cdp_tiers", MASTER_DATA_TTL, async () => {
    const row = await db
      .prepare("SELECT value FROM configs WHERE key = 'cdp_tiers' LIMIT 1")
      .first<{ value: string }>();

    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value) as Partial<CdpTiersConfig>;
        return {
          bronze: parsed.bronze || DEFAULT_CDP_TIERS.bronze,
          silver: parsed.silver || DEFAULT_CDP_TIERS.silver,
          gold: parsed.gold || DEFAULT_CDP_TIERS.gold,
        };
      } catch (e) {
        console.error("Failed to parse cdp_tiers config JSON:", e);
      }
    }
    return DEFAULT_CDP_TIERS;
  });
}

/**
 * Get overnight checkin slots list from D1 cached for 60 minutes
 */
export async function getCachedHourlySlots(db: D1Database): Promise<number[]> {
  return getOrSet("master:hourly_slots", MASTER_DATA_TTL, async () => {
    const row = await db
      .prepare("SELECT value FROM configs WHERE key = 'hourly_checkin_slots' LIMIT 1")
      .first<{ value: string }>();

    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value) as HourlySlotsConfig;
        if (Array.isArray(parsed?.slots) && parsed.slots.length > 0) {
          return parsed.slots;
        }
      } catch (e) {
        console.error("Failed to parse hourly_checkin_slots config JSON:", e);
      }
    }
    return DEFAULT_HOURLY_SLOTS;
  });
}

/**
 * Get active promotion categories cached for 60 minutes
 */
export async function getCachedPromotionCategories(db: D1Database): Promise<PromotionCategory[]> {
  return getOrSet("master:promotion_categories", MASTER_DATA_TTL, async () => {
    const { results } = await db
      .prepare(
        `SELECT id, name, code, description, icon, badge_color, sort_order, is_active, created_at, updated_at
         FROM promotion_categories
         WHERE is_active = 1
         ORDER BY sort_order ASC, name ASC`
      )
      .all<PromotionCategory>();
    return results || [];
  });
}

/**
 * Get active promotions cached for 60 minutes
 */
export async function getCachedActivePromotions(db: D1Database): Promise<Promotion[]> {
  return getOrSet("master:promotions:active", MASTER_DATA_TTL, async () => {
    const { results } = await db
      .prepare(
        `SELECT p.*, c.name as category_name, c.code as category_code, c.icon as category_icon, c.badge_color as category_color
         FROM promotions p
         LEFT JOIN promotion_categories c ON p.category_id = c.id
         WHERE p.is_active = 1
         ORDER BY p.created_at DESC`
      )
      .all<any>();

    return (results || []).map((row) => ({
      ...row,
      applicable_room_classes: typeof row.applicable_room_classes === "string" ? JSON.parse(row.applicable_room_classes) : (row.applicable_room_classes || []),
      applicable_booking_types: typeof row.applicable_booking_types === "string" ? JSON.parse(row.applicable_booking_types) : (row.applicable_booking_types || []),
      applicable_loyalty_tiers: typeof row.applicable_loyalty_tiers === "string" ? JSON.parse(row.applicable_loyalty_tiers) : (row.applicable_loyalty_tiers || []),
      applicable_days_of_week: typeof row.applicable_days_of_week === "string" ? JSON.parse(row.applicable_days_of_week) : (row.applicable_days_of_week || [0, 1, 2, 3, 4, 5, 6]),
    }));
  });
}

export function invalidatePromotionsCache(): void {
  invalidatePrefix("master:promotion");
}

/**
 * Manually invalidate all master data caches
 */
export function invalidateAllMasterCache(): void {
  invalidatePrefix("master:");
}

