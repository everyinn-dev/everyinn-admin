/**
 * Core DTO → legacy Admin UI shapes.
 *
 * The Admin UI was built against the old direct-SQL route handlers. Instead of rewriting every component in
 * one go, the BFF keeps the JSON shapes the UI already consumes and translates the Core contracts here.
 * Core timestamps are UTC ISO strings (same as legacy rows), so they pass through unchanged.
 */
import type {
  Booking,
  BookingRulesConfig,
  BookingStatus,
  BookingType,
  DepositStatus,
  GanttBlockItem,
  GanttBookingItem,
  GanttRoomData,
  PricingRule,
  Room,
  RoomClass,
} from "@/types";

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
  status: "active" | "released";
  /** Core returns a `{ id, name }` staff reference, not a bare id. */
  createdBy: { id: number; name: string | null } | null;
  createdAt: string;
  releasedAt: string | null;
  releasedBy: { id: number; name: string | null } | null;
  releaseReason: string | null;
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
    createdByStaffId: b.createdBy?.id,
    createdAt: b.createdAt,
    version: b.version,
  };
}

/** Legacy `GET /api/room-blocks` row shape (snake_case, joined room + staff name). */
export function toLegacyRoomBlock(b: CoreBlock) {
  return {
    id: b.id,
    room_id: b.roomId,
    room_name: b.roomName,
    room_class: b.roomClass,
    blocked_from: b.blockedFrom,
    blocked_to: b.blockedTo,
    reason: b.reason,
    note: b.note,
    status: b.status,
    created_by: b.createdBy?.id ?? null,
    created_by_staff_name: b.createdBy?.name ?? null,
    created_at: b.createdAt,
    released_at: b.releasedAt,
    release_reason: b.releaseReason,
    // Needed by the UI to release the block (optimistic concurrency).
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

// ───────────────────────── Booking list/detail (A-W1a) ─────────────────────────

/** `{ id, name }` reference the Core returns for any staff-attributed action. */
export interface CoreStaffRef {
  id: number;
  name: string | null;
}

/**
 * Full booking DTO from Booking Core (`bookingDto`). Staff names are denormalised inside
 * `booking-db`, so the BFF never has to join Admin's `staff` table to render a list.
 */
export interface CoreBookingDto {
  id: string;
  propertyId: string;
  roomId: string;
  roomName: string | null;
  roomNumber: string | null;
  roomClass: RoomClass;
  customerId: string | null;
  guest: {
    phone: string | null;
    phoneDisplay: string;
    contactRaw: string;
    name: string;
    instagram: string | null;
    facebook: string | null;
  };
  numGuests: number;
  bookingType: BookingType;
  ratePlanCode: string;
  checkinAt: string;
  checkoutAt: string;
  occupiedUntil: string;
  lateCheckoutHours: number;
  status: BookingStatus;
  source: string;
  note: string | null;
  closingNote: string | null;
  pricing: {
    basePrice: number;
    extraFee: number;
    promotionDiscount: number;
    loyaltyDiscount: number;
    discountAmount: number;
    totalPrice: number;
    originalPrice: number | null;
    isFinal: boolean;
  };
  promotion: { id: string; code: string | null; name: string; version: number; discountAmount: number } | null;
  loyalty: {
    syncStatus: "not_applicable" | "pending" | "synced";
    step: number | null;
    tier: string | null;
    syncedAt: string | null;
  };
  financial: {
    isDeposit: boolean;
    depositAmount: number;
    paidAmount: number;
    refundAmount: number;
    remainingAmount: number;
    depositStatus: DepositStatus;
    depositDueDate: string | null;
    depositPaidAt: string | null;
    depositReminderSentAt: string | null;
    depositReminderSentBy: CoreStaffRef | null;
    remainingPaidAt: string | null;
    remainingPaidBy: CoreStaffRef | null;
  };
  lifecycle: {
    confirmedAt: string | null;
    cancelledAt: string | null;
    cancelledBy: CoreStaffRef | null;
    cancelReason: string | null;
    noShowAt: string | null;
    noShowBy: CoreStaffRef | null;
    noShowReason: string | null;
  };
  control: {
    version: number;
    createdAt: string;
    createdBy: CoreStaffRef | null;
    updatedAt: string;
    updatedBy: CoreStaffRef | null;
  };
}

export interface CoreBookingListResponse {
  bookings: CoreBookingDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Legacy rows were raw snake_case D1 columns; `undefined` (not `null`) is what the UI expects for "absent". */
const u = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

/**
 * Flatten a Core booking DTO back into the legacy snake_case row the bookings table renders.
 *
 * Intentional semantic notes (approved, EI-PHASE1-STATUS A-W1a):
 * - `mod_no` maps to `control.version`. Core bumps version on every write whereas legacy `mod_no`
 *   counted modifications, so the "edited by" badge can appear slightly sooner. Cosmetic only.
 * - `member_phone` uses `guest.phoneDisplay` (national format) to match legacy rendering; bookings
 *   with no parsable phone fall back to the raw contact string.
 */
export function toLegacyBookingRow(d: CoreBookingDto): Booking {
  const { guest: g, pricing: p, financial: f, lifecycle: l, control: c } = d;
  return {
    id: d.id,
    property_id: d.propertyId,
    room_id: d.roomId,
    room_name: u(d.roomName),
    room_class: d.roomClass,
    member_phone: g.phoneDisplay || g.contactRaw,
    member_name: g.name,
    num_guests: d.numGuests,
    booking_type: d.bookingType,
    checkin_at: d.checkinAt,
    checkout_at: d.checkoutAt,
    late_checkout_hours: d.lateCheckoutHours,
    instagram: u(g.instagram),
    facebook: u(g.facebook),
    closing_note: u(d.closingNote),
    note: u(d.note),
    status: d.status,

    base_price: p.basePrice,
    extra_fee: p.extraFee,
    discount_amount: p.discountAmount,
    total_price: p.totalPrice,
    original_price: u(p.originalPrice),

    promotion_id: u(d.promotion?.id),
    promotion_code: u(d.promotion?.code),

    cancelled_at: u(l.cancelledAt),
    cancel_reason: u(l.cancelReason),
    cancelled_by: u(l.cancelledBy?.id),
    no_show_at: u(l.noShowAt),
    no_show_by: u(l.noShowBy?.id),
    no_show_by_staff_name: l.noShowBy?.name ?? null,
    no_show_reason: u(l.noShowReason),
    refund_amount: f.refundAmount,

    is_deposit: f.isDeposit ? 1 : 0,
    deposit_amount: f.depositAmount,
    paid_amount: f.paidAmount,
    remaining_amount: f.remainingAmount,
    deposit_due_date: u(f.depositDueDate),
    deposit_status: f.depositStatus,
    deposit_paid_at: u(f.depositPaidAt),
    deposit_reminder_sent_at: u(f.depositReminderSentAt),
    deposit_reminder_sent_by: u(f.depositReminderSentBy?.id),
    deposit_reminder_sent_by_staff_name: f.depositReminderSentBy?.name ?? null,
    remaining_paid_at: u(f.remainingPaidAt),
    remaining_paid_by: u(f.remainingPaidBy?.id),
    remaining_paid_by_staff_name: f.remainingPaidBy?.name ?? null,

    // ControlFields
    created_at: c.createdAt,
    created_by_staff_id: c.createdBy?.id ?? null,
    created_by_staff_name: c.createdBy?.name ?? null,
    updated_at: c.updatedAt,
    updated_by_staff_id: c.updatedBy?.id ?? null,
    updated_by_staff_name: c.updatedBy?.name ?? null,
    mod_no: c.version,
  };
}
