/**
 * Core DTO → legacy Admin UI shapes.
 *
 * The Admin UI was built against the old direct-SQL route handlers. Instead of rewriting every component in
 * one go, the BFF keeps the JSON shapes the UI already consumes and translates the Core contracts here.
 * Core timestamps are UTC ISO strings (same as legacy rows), so they pass through unchanged.
 */
import type { BookingRulesConfig, GanttBlockItem, GanttBookingItem, GanttRoomData, PricingRule, Room, RoomClass } from "@/types";

// ───────────────────────── Booking Core DTOs (subset the BFF reads) ─────────────────────────

export interface CoreRoom {
  id: string;
  roomNumber: string;
  name: string;
  roomClass: RoomClass;
  floor: number;
  areaSqm: number | null;
  maxGuests: number;
  sortOrder: number;
  isActive: boolean;
  version: number;
}

export interface CoreBlock {
  id: string;
  roomId: string;
  roomName: string | null;
  roomClass: string | null;
  blockedFrom: string;
  blockedTo: string;
  reason: string | null;
  note: string | null;
  status: string;
  createdBy: number | string | null;
  createdAt: string;
  releasedAt: string | null;
  version: number;
}

export interface CoreGanttBooking {
  id: string;
  roomId: string;
  guestName: string;
  phone: string;
  instagram: string | null;
  facebook: string | null;
  closingNote: string | null;
  note: string | null;
  bookingType: GanttBookingItem["bookingType"];
  ratePlanCode: string;
  checkinAt: string;
  checkoutAt: string;
  occupiedUntil: string;
  totalPrice: number;
  status: "pending" | "confirmed";
  loyaltySyncStatus: "not_applicable" | "pending" | "synced";
  isDeposit: 0 | 1;
  depositAmount: number;
  paidAmount: number;
  remainingAmount: number;
  depositDueDate: string | null;
  depositStatus: "none" | "deposit_paid" | "fully_paid";
  depositPaidAt: string | null;
  depositReminderSentAt: string | null;
  remainingPaidAt: string | null;
  modNo: number;
  version: number;
}

export interface CoreGantt {
  date?: string;
  month?: string;
  daysInMonth?: number;
  range: { from: string; to: string };
  bookingsVersion: number;
  rooms: Array<CoreRoom & { bookings: CoreGanttBooking[]; blocks: CoreBlock[] }>;
}

export interface CoreRateRule {
  id: string;
  roomClass: RoomClass;
  ratePlanCode: "combo3h" | "combo6h" | "overnight" | "dayroom" | "custom";
  basePrice: number;
  extraHourFee: number;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

export interface CoreCatalog {
  catalogVersion: number;
  property: { id: string; name: string; address: string } | null;
  rooms: CoreRoom[];
  rateRules: CoreRateRule[];
  bookingRules: BookingRulesConfig & { max_stay_hours: number; require_social_account: boolean; version?: number };
  hourlyCheckinSlots: { slots: number[]; version: number };
  inventoryPolicy: { slotMinutes: number; turnoverMinutes: number; timezone: string };
  promotionCategories: unknown[];
  activePromotions: unknown[];
}

// ───────────────────────── CDP Core DTOs ─────────────────────────

export type CoreTier = "not_member" | "bronze" | "silver" | "gold";

export interface CoreCustomer {
  customerId: string;
  phone: string | null;
  phoneNational: string | null;
  fullName: string | null;
  instagram: string | null;
  facebook: string | null;
  internalNotes: string | null;
  preferredRoomClass: string | null;
  isBlocked: boolean;
  marketingConsent: "unknown" | "granted" | "denied";
  loyalty: {
    tier: CoreTier;
    tierRuleVersion: string;
    lifetimeBookingCount: number;
    nextTier: { code: CoreTier; remainingBookings: number } | null;
    cancelledCount: number;
    noShowCount: number;
    firstCountedAt: string | null;
    lastCountedAt: string | null;
    stamp: {
      status: "none" | "active" | "completed" | "expired";
      programCode: string;
      currentStep: number;
      maxSteps: number;
      startsAt: string | null;
      expiresAt: string | null;
      nextMilestoneStep: number | null;
      milestones: Array<{ step: number; label: string; status: "reached" | "upcoming" }>;
      cycleId: string | null;
    };
    rulesVersion: string;
  };
  legacy: { totalSpent: number | null; totalBookings: number | null; loyaltyTier: string | null; note: string };
  reconciliationStatus: "ok" | "needs_review" | "social_only";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CoreLoyaltyRules {
  rulesVersion: string;
  tierRules: { basis: string; tiers: Array<{ code: CoreTier; minBookings: number; maxBookings: number | null }> };
  stampProgram: {
    programCode: string;
    cycleLifetimeDays: number;
    maxSteps: number;
    milestones: Array<{ step: number; rewardType: "fixed_discount"; rewardValue: number; label: string }>;
  };
}

// ───────────────────────── Mappers ─────────────────────────

const nz = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

export function toLegacyRoom(r: CoreRoom, propertyId = "every-inn"): Room {
  return {
    id: r.id,
    property_id: propertyId,
    room_number: r.roomNumber,
    name: r.name,
    room_class: r.roomClass,
    floor: r.floor,
    area_sqm: nz(r.areaSqm),
    max_guests: r.maxGuests,
    sort_order: r.sortOrder,
    is_active: r.isActive ? 1 : 0,
    created_at: "",
    updated_at: "",
  };
}

export function toLegacyPricingRule(r: CoreRateRule, propertyId = "every-inn", index = 0): PricingRule | null {
  if (r.ratePlanCode === "custom") return null; // custom has no catalog price in the legacy UI
  return {
    id: index + 1,
    property_id: propertyId,
    room_class: r.roomClass,
    booking_type: r.ratePlanCode,
    base_price: r.basePrice,
    extra_hour_fee: r.extraHourFee,
    is_active: r.isActive ? 1 : 0,
    created_at: r.updatedAt,
  };
}

export function toGanttBooking(b: CoreGanttBooking): GanttBookingItem & {
  version: number;
  ratePlanCode: string;
  occupiedUntil: string;
  loyaltySyncStatus: CoreGanttBooking["loyaltySyncStatus"];
} {
  return {
    id: b.id,
    roomId: b.roomId,
    guestName: b.guestName,
    phone: b.phone,
    instagram: nz(b.instagram),
    facebook: nz(b.facebook),
    closingNote: nz(b.closingNote),
    note: nz(b.note),
    bookingType: b.bookingType,
    checkinAt: b.checkinAt,
    checkoutAt: b.checkoutAt,
    totalPrice: b.totalPrice,
    status: b.status,
    isDeposit: b.isDeposit,
    depositAmount: b.depositAmount,
    paidAmount: b.paidAmount,
    remainingAmount: b.remainingAmount,
    depositDueDate: nz(b.depositDueDate),
    depositStatus: b.depositStatus,
    depositPaidAt: nz(b.depositPaidAt),
    depositReminderSentAt: nz(b.depositReminderSentAt),
    remainingPaidAt: nz(b.remainingPaidAt),
    modNo: b.modNo,
    // Core-only fields the UI needs for optimistic concurrency, turnover rendering and sync badges.
    version: b.version,
    ratePlanCode: b.ratePlanCode,
    occupiedUntil: b.occupiedUntil,
    loyaltySyncStatus: b.loyaltySyncStatus,
  };
}

export function toGanttBlock(b: CoreBlock): GanttBlockItem & { version: number } {
  return {
    id: b.id,
    roomId: b.roomId,
    blockedFrom: b.blockedFrom,
    blockedTo: b.blockedTo,
    reason: nz(b.reason),
    note: nz(b.note),
    createdByStaffId: typeof b.createdBy === "number" ? b.createdBy : b.createdBy ? Number(b.createdBy) || undefined : undefined,
    createdAt: b.createdAt,
    version: b.version,
  };
}

export function toGanttRoom(r: CoreGantt["rooms"][number], includeDetail: boolean): GanttRoomData {
  return {
    id: r.id,
    roomNumber: r.roomNumber,
    name: r.name,
    roomClass: r.roomClass,
    floor: r.floor,
    bookings: r.bookings.map((b) => {
      const item = toGanttBooking(b);
      if (includeDetail) return item;
      // Day view historically returned the slim shape; keep payload small.
      const { id, roomId, guestName, phone, instagram, facebook, closingNote, bookingType, checkinAt, checkoutAt, totalPrice, status, note, version, occupiedUntil, loyaltySyncStatus, ratePlanCode } = item;
      return { id, roomId, guestName, phone, instagram, facebook, closingNote, bookingType, checkinAt, checkoutAt, totalPrice, status, note, version, occupiedUntil, loyaltySyncStatus, ratePlanCode } as GanttBookingItem;
    }),
    blocks: r.blocks.map(toGanttBlock),
  };
}

/** Legacy `LoyaltyTier` had `new` for non-members. */
export function toLegacyTier(t: CoreTier): "new" | "bronze" | "silver" | "gold" {
  return t === "not_member" ? "new" : t;
}

/** Shape returned by the old `GET /api/members/[phone]` plus the new loyalty block. */
export function toLegacyMemberResponse(c: CoreCustomer) {
  return {
    phone: c.phoneNational ?? c.phone ?? "",
    customerId: c.customerId,
    fullName: c.fullName,
    instagram: c.instagram,
    facebook: c.facebook,
    totalBookings: c.loyalty.lifetimeBookingCount,
    totalSpent: c.legacy.totalSpent ?? 0, // legacy reference only — never used for tier (§20.1)
    totalNights: 0,
    loyaltyTier: toLegacyTier(c.loyalty.tier),
    preferredRoomClass: c.preferredRoomClass,
    lastBookedAt: c.loyalty.lastCountedAt,
    isBlocked: c.isBlocked ? 1 : 0,
    noShowCount: c.loyalty.noShowCount,
    internalNotes: c.internalNotes,
    version: c.version,
    loyalty: c.loyalty,
    reconciliationStatus: c.reconciliationStatus,
  };
}

/** Legacy `cdpTiers` config derived from CDP rules (booking-count thresholds only; spend no longer drives tier). */
export function toLegacyCdpTiers(rules: CoreLoyaltyRules) {
  const out: Record<string, { min_spent: number; min_bookings: number }> = {};
  for (const t of rules.tierRules.tiers) {
    if (t.code === "not_member") continue;
    out[t.code] = { min_spent: 0, min_bookings: t.minBookings };
  }
  return out;
}

export function daysInMonthOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

