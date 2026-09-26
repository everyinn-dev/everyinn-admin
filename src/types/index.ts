export type RoomClass = 'haven' | 'signature';
export type BookingType = 'hourly' | 'overnight' | 'dayuse' | 'custom';
export type BookingStatus = 'confirmed' | 'pending' | 'holding' | 'cancelled';
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
  total_spent: number;
  total_nights: number;
  first_booked_at?: string;
  last_booked_at?: string;
  loyalty_tier: LoyaltyTier;
  preferred_room_class?: string;
  instagram?: string;
  facebook?: string;
  internal_notes?: string;
  is_blocked: number;
  portal_opt_in: number;
  created_at: string;
  updated_at: string;
}

export interface Booking {
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
  created_by_staff_id?: number;
  created_by_staff_name?: string;
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

  created_at: string;
  updated_at: string;
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

