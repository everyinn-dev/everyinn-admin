export type RoomClass = 'haven' | 'signature';
export type BookingType = 'hourly' | 'overnight' | 'dayuse' | 'custom';
export type BookingStatus = 'confirmed' | 'pending' | 'holding' | 'cancelled' | 'no_show';
export type LoyaltyTier = 'new' | 'bronze' | 'silver' | 'gold';
export type StaffRole = 'receptionist' | 'manager';

export interface BookingRulesConfig {
  min_hourly: number;
  max_hourly_checkin: string;
  overnight_start: string;
  overnight_max_checkout: string;
  day_checkin: string;
  day_checkout: string;
  max_late_checkout_hours: number;
  extra_hour_fee: number;
}

export interface TierThreshold {
  min_spent: number;
  min_bookings: number;
}

export interface CdpTiersConfig {
  bronze: TierThreshold;
  silver: TierThreshold;
  gold: TierThreshold;
}

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
  property_id: string;
  room_number: string;
  name: string;
  room_class: RoomClass;
  floor: number;
  area_sqm?: number;
  max_guests: number;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: number;
  property_id: string;
  room_class: RoomClass;
  booking_type: 'combo3h' | 'combo6h' | 'overnight' | 'dayroom';
  base_price: number;
  extra_hour_fee: number;
  is_active: number;
  created_at: string;
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

/**
 * Standard Control Fields (Audit & Modification Tracking) for all operational tables.
 */
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
  late_checkout_hours: number;
  instagram?: string;
  facebook?: string;
  closing_note?: string;
  note?: string;
  status: BookingStatus;

  base_price: number;
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

  // No-Show and Refund tracking
  no_show_at?: string;
  no_show_by?: number;
  no_show_by_staff_name?: string | null;
  no_show_reason?: string;
  refund_amount?: number;
  original_price?: number;
}

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
  bookingType: BookingType;
  checkinAt: string;
  checkoutAt: string;
  totalPrice: number;
  status: BookingStatus;
  instagram?: string;
  facebook?: string;
  closingNote?: string;
  note?: string;
  // Control fields
  createdAt?: string;
  createdByStaffId?: number | null;
  createdByStaffName?: string | null;
  updatedAt?: string;
  updatedByStaffId?: number | null;
  updatedByStaffName?: string | null;
  modNo?: number;
  // No-Show and Refund tracking
  noShowAt?: string;
  noShowBy?: number;
  noShowByStaffName?: string | null;
  noShowReason?: string;
  refundAmount?: number;
  originalPrice?: number;
}

export interface GanttBlockItem {
  id: number;
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
  // Control fields
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


