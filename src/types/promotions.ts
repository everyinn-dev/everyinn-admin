import { BookingType, LoyaltyTier, RoomClass } from "./index";

export type DiscountType = "percentage" | "fixed_amount";

export type PromotionBadgeColor = "purple" | "amber" | "emerald" | "sky" | "rose" | "indigo";

export interface PromotionCategory {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  icon: string;
  badge_color: PromotionBadgeColor;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  promo_count?: number;
}

export interface Promotion {
  id: string;
  category_id: string;
  category_name?: string;
  category_code?: string;
  category_icon?: string;
  category_color?: PromotionBadgeColor;
  name: string;
  code?: string | null;
  description?: string | null;

  // Discount Mechanism
  discount_type: DiscountType;
  discount_value: number; // percentage (e.g. 10) or fixed amount (e.g. 50000)
  max_discount_amount?: number | null; // maximum VND cap for percentage discount

  // Eligibility conditions
  min_order_amount: number;
  applicable_room_classes: RoomClass[];
  applicable_booking_types: BookingType[];
  applicable_loyalty_tiers: LoyaltyTier[];
  applicable_days_of_week?: number[]; // [0..6] (0 = Sunday, 1 = Monday ...)

  // Duration / Seasonal validity
  start_date?: string | null; // 'YYYY-MM-DD'
  end_date?: string | null; // 'YYYY-MM-DD'

  // Limits
  usage_limit?: number | null;
  used_count: number;

  // Status & Control
  is_active: number;
  created_by_staff_id?: number | null;
  updated_by_staff_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionEligibilityContext {
  roomClass: RoomClass;
  bookingType: BookingType;
  checkinAt: Date;
  rawSubtotal: number;
  memberTier: LoyaltyTier;
}

export interface PromotionValidationResult {
  eligible: boolean;
  reason?: string;
  discountAmount: number;
  finalPrice: number;
  promotion?: Promotion;
}
