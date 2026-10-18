export type RoomClass = "haven" | "signature";

export type BookingType = "hourly" | "overnight" | "dayuse" | "custom";

export type BookingStatus = "confirmed" | "pending" | "holding" | "cancelled" | "no_show";

export type DepositStatus = "none" | "deposit_paid" | "fully_paid";

export type LoyaltyTier = "new" | "bronze" | "silver" | "gold";

export type StaffRole = "admin" | "receptionist" | "manager";

export type LoyaltySyncStatus = "not_applicable" | "pending" | "synced" | "failed";

export interface BookingRulesConfig {
  min_hourly?: number;
  max_hourly_checkin: string;
  overnight_start?: string;
  overnight_max_checkout?: string;
  day_checkin?: string;
  day_checkout?: string;
  max_late_checkout_hours?: number;
  extra_hour_fee?: number;

  min_hourly_duration?: number;
  min_hourly_checkin?: string;
  overnight_earliest_start?: string;
  overnight_latest_start?: string;
  overnight_duration_hours?: number;
  dayuse_checkin_time?: string;
  dayuse_checkout_time?: string;
  cleaning_buffer_minutes?: number;
  standard_guests?: number;
}

export interface TierThreshold {
  min_spent: number;
  min_bookings: number;
}

export interface CdpTierInfo {
  min_spent: number;
  min_bookings?: number;
  discount_percent?: number;
  label?: string;
  perk?: string;
}

export type CdpTiersConfig = Record<LoyaltyTier, CdpTierInfo> | {
  bronze: TierThreshold;
  silver: TierThreshold;
  gold: TierThreshold;
};

export interface HourlySlotsConfig {
  slots: number[];
}

export interface Property {
  id: string;
  name: string;
  address: string;
  bank_id: string;
  bank_account: string;
  bank_holder_name: string;
  checkin_instruction?: string;
  wifi_ssid?: string;
  wifi_password?: string;
  telegram_chat_id?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  property_id?: string;
  room_number: string;
  name: string;
  room_class: RoomClass;
  floor: number;
  area_sqm?: number;
  max_guests: number;
  sort_order?: number;
  is_active: number;
  amenities?: string[];
  images?: string[];
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PricingRule {
  id: number;
  property_id?: string;
  room_class: RoomClass;
  booking_type: "combo3h" | "combo6h" | "overnight" | "dayroom" | Exclude<BookingType, "custom">;
  base_duration_hours?: number;
  base_price: number;
  extra_hour_fee: number;
  is_active?: number;
  created_at?: string;
  notes?: string;
}

export interface SurchargeRule {
  id: string;
  code: string;
  name: string;
  surcharge_type: "holiday" | "extra_guest" | "custom_fee";
  calc_mode: "percentage" | "fixed_amount";
  amount: number;
  unit_scope: "per_night" | "per_guest_night" | "per_booking";
  guest_threshold: number;
  start_date: string | null;
  end_date: string | null;
  applicable_days_of_week: number[];
  applicable_room_classes: RoomClass[];
  applicable_booking_types: BookingType[];
  priority: number;
  is_active: number;
  notes?: string | null;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Staff {
  id: number;
  phone: string;
  full_name: string;
  role: StaffRole;
  is_active: number;
  last_login_at?: string;
  created_at: string;
}

export interface StaffSession {
  token: string;
  staff_id: number;
  expires_at: string;
  created_at: string;
}

export interface Member {
  phone: string;
  full_name?: string;
  fullName?: string;
  total_bookings: number;
  totalBookings?: number;
  total_spent: number;
  totalSpent?: number;
  total_nights: number;
  totalNights?: number;
  first_booked_at?: string;
  last_booked_at?: string;
  lastBookedAt?: string;
  loyalty_tier: LoyaltyTier;
  loyaltyTier?: LoyaltyTier;
  preferred_room_class?: string;
  preferredRoomClass?: string;
  instagram?: string;
  facebook?: string;
  zalo?: string;
  internal_notes?: string;
  internalNotes?: string;
  is_blocked: number;
  isBlocked?: number;
  no_show_count?: number;
  noShowCount?: number;
  portal_opt_in: number;
  created_at?: string;
  updated_at?: string;
}

export interface ControlFields {
  created_at: string;
  created_by_staff_id?: number | null;
  created_by_staff_name?: string | null;
  updated_at: string;
  updated_by_staff_id?: number | null;
  updated_by_staff_name?: string | null;
  mod_no: number;
}

export interface Booking extends ControlFields {
  id: string;
  property_id: string;
  room_id: string;
  room_name?: string;
  room_class?: RoomClass;
  member_phone: string;
  member_name: string;
  num_guests: number;
  booking_type: BookingType;
  checkin_at: string; // ISO string
  checkout_at: string; // ISO string
  early_checkin_hours?: number;
  late_checkout_hours: number;
  instagram?: string;
  facebook?: string;
  zalo?: string;
  closing_note?: string;
  note?: string;
  status: BookingStatus;

  base_price: number;
  holiday_surcharge?: number;
  extra_guest_fee?: number;
  extra_fee: number;
  discount_amount: number;
  total_price: number;

  hold_expires_at?: string;
  payment_confirmed_at?: string;
  payment_confirmed_by?: number;
  door_code?: string;
  door_code_sent_at?: string;
  public_token?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  cancelled_by?: number;

  // Promotion tracking
  promotion_id?: string;
  promotion_code?: string;
  promotion_name?: string | null;

  // No-Show and Refund tracking
  no_show_at?: string;
  no_show_by?: number;
  no_show_by_staff_name?: string | null;
  no_show_reason?: string;
  refund_amount?: number;
  original_price?: number;

  // Deposit tracking
  is_deposit?: number;
  deposit_amount?: number;
  paid_amount?: number;
  remaining_amount?: number;
  deposit_due_date?: string | null;
  deposit_status?: DepositStatus;
  deposit_paid_at?: string | null;
  deposit_reminder_sent_at?: string | null;
  deposit_reminder_sent_by?: number;
  deposit_reminder_sent_by_staff_name?: string | null;
  remaining_paid_at?: string | null;
  remaining_paid_by?: number;
  remaining_paid_by_staff_name?: string | null;

  // Loyalty sync tracking (A-W8)
  loyalty_sync_status?: LoyaltySyncStatus;
  loyalty_tier?: string | null;
  loyalty_step?: number | null;
  loyalty_synced_at?: string | null;
  version?: number;
}

export * from "./promotions";

export interface RoomBlock {
  id: number;
  room_id: string;
  blocked_from: string;
  blocked_to: string;
  reason?: string;
  note?: string;
  created_by?: number;
  created_at: string;
}

export interface EventLog {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: string;
  staff_id?: number;
  created_at: string;
}

// Gantt response types
export interface GanttBookingItem {
  id: string;
  roomId: string;
  guestName: string;
  phone: string;
  instagram?: string;
  facebook?: string;
  zalo?: string;
  bookingType: BookingType;
  checkinAt: string;
  checkoutAt: string;
  earlyCheckinHours?: number;
  lateCheckoutHours?: number;
  numGuests?: number;
  basePrice?: number;
  holidaySurcharge?: number;
  extraGuestFee?: number;
  extraFee?: number;
  discountAmount?: number;
  promotionName?: string | null;
  totalPrice: number;
  status: BookingStatus;
  note?: string;
  closingNote?: string;
  createdByStaffId?: number | null;
  createdByStaffName?: string | null;
  createdAt?: string;
  modNo?: number;
  version?: number;
  loyaltySyncStatus?: LoyaltySyncStatus;
  updatedAt?: string;
  updatedByStaffId?: number | null;
  updatedByStaffName?: string | null;
  noShowAt?: string;
  noShowBy?: number;
  noShowByStaffName?: string | null;
  noShowReason?: string;
  refundAmount?: number;
  originalPrice?: number;
  // Deposit fields
  isDeposit?: number;
  depositAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  depositDueDate?: string | null;
  depositStatus?: DepositStatus;
  depositPaidAt?: string | null;
  remainingPaidAt?: string | null;
  depositReminderSentAt?: string | null;
  ratePlanCode?: string;
  occupiedUntil?: string;
}

export interface GanttBlockItem {
  id: number | string;
  version?: number;
  roomId: string;
  blockedFrom: string;
  blockedTo: string;
  reason?: string;
  note?: string;
  createdByStaffId?: number;
  createdAt?: string;
}

export interface GanttRoomData {
  id: string;
  roomNumber: string;
  name: string;
  roomClass: RoomClass;
  floor: number;
  bookings: GanttBookingItem[];
  blocks: GanttBlockItem[];
}

export interface GanttDataResponse {
  date?: string; // YYYY-MM-DD (when query is for a single day)
  month?: string; // YYYY-MM (when query is for a full month)
  daysInMonth?: number;
  rooms: GanttRoomData[];
}

export interface BookingsListResponse {
  bookings: Booking[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Daily Roster (Operational Hub) Types
export interface DailyRosterItem {
  id: string;
  roomId: string;
  roomName: string;
  roomNumber: string;
  roomClass: RoomClass;
  floor: number;
  guestName: string;
  phone: string;
  instagram?: string;
  facebook?: string;
  zalo?: string;
  bookingType: BookingType;
  checkinAt: string;
  checkoutAt: string;
  turnoverStartAt?: string;
  turnoverEndAt?: string;
  totalPrice: number;
  status: BookingStatus;
  doorCode?: string;
  doorCodeSentAt?: string;
  closingNote?: string;
  note?: string;
  loyaltyTier?: LoyaltyTier;
  totalBookings?: number;
  lateCheckoutHours: number;
  createdAt?: string;
  createdByStaffId?: number | null;
  createdByStaffName?: string | null;
  updatedAt?: string;
  updatedByStaffId?: number | null;
  updatedByStaffName?: string | null;
  modNo?: number;
}

export interface DailyRosterSummary {
  totalCheckins: number;
  totalCheckouts: number;
  hourlyCount: number;
  overnightCount: number;
  dayuseCount: number;
  customCount: number;
  doorCodeMissingCount: number;
}

export interface DailyRosterResponse {
  date: string; // YYYY-MM-DD
  summary: DailyRosterSummary;
  checkins: DailyRosterItem[];
  checkouts: DailyRosterItem[];
}

// Pricing calculation models
export interface NightlyBreakdownItem {
  stayDate: string;
  businessDate?: string;
  baseRate?: number;
  basePrice?: number;
  holidayRuleId?: string | null;
  holidayRuleName?: string | null;
  holidaySurchargePercent?: number;
  holidaySurchargeAmount?: number;
  holidaySurcharge?: number;
  extraGuests?: number;
  extraGuestFee?: number;
}

export interface CappingWarning {
  exceeded?: boolean;
  exceedsThreshold?: boolean;
  excessAmount?: number;
  currentSubtotal?: number;
  suggestedRatePlanCode?: string;
  suggestedBookingType?: "overnight" | "dayuse";
  suggestedBasePrice?: number;
  savingAmount?: number;
  currentPrice?: number;
  suggestedPrice?: number;
  message?: string;
}

export interface CalculatedPricing {
  basePrice: number;
  holidaySurcharge: number;
  totalExtraFee: number;
  extraGuestFee: number;
  discountAmount: number;
  totalPrice: number;
  nightlyBreakdown?: NightlyBreakdownItem[];
  cappingWarning?: CappingWarning;
}

export interface CreateBookingPayload {
  roomId: string;
  phone: string;
  name: string;
  instagram?: string;
  facebook?: string;
  zalo?: string;
  bookingType: BookingType;
  checkinAt: string;
  checkoutAt: string;
  earlyCheckinHours?: number;
  lateCheckoutHours?: number;
  numGuests?: number;
  customPrice?: number;
  promotionId?: string | null;
  promotionCode?: string | null;
  discountAmount?: number;
  note?: string;
  closingNote: string;
  status?: BookingStatus;
  isDeposit?: boolean;
  depositAmount?: number;
  depositDueDate?: string | null;
}
