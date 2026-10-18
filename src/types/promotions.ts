import { BookingType, LoyaltyTier, RoomClass } from "./index";

export type DiscountType = "percentage" | "fixed_amount";

export type PromotionBadgeColor = "purple" | "amber" | "emerald" | "sky" | "rose" | "indigo";

export interface PromotionCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  icon: string;
  badge_color?: PromotionBadgeColor;
  color?: string;
  is_system?: number;
  sort_order: number;
  is_active: number;
  promo_count?: number;
  promotion_count?: number;
  version?: number;
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: string;
  code?: string | null;
  name: string;
  category_id: string;
  category_name?: string;
  category_code?: string;
  category_icon?: string;
  category_color?: PromotionBadgeColor | string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount: number;
  applicable_room_classes: RoomClass[];
  applicable_booking_types: BookingType[];
  applicable_loyalty_tiers: LoyaltyTier[];
  applicable_days_of_week?: number[];
  start_date: string | null;
  end_date: string | null;
  booking_window_start?: string | null;
  booking_window_end?: string | null;
  min_nights?: number;
  blackout_dates?: string[];
  is_stackable_with_holiday?: number;
  usage_limit: number | null;
  max_uses_per_guest?: number | null;
  used_count: number;
  is_active: number;
  version?: number;
  created_by_staff_id?: number | null;
  created_by_staff_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PromotionEvaluationContext {
  roomClass: RoomClass;
  bookingType: BookingType;
  checkinAt: Date;
  checkoutAt?: Date;
  basePrice: number; // Giá cơ bản của hình thức đặt phòng (Promotion chỉ giảm trên basePrice)
  rawSubtotal?: number; // Tương thích ngược nếu caller cũ truyền rawSubtotal
  memberTier: LoyaltyTier;
  hasHolidaySurcharge?: boolean;
  guestUsedCount?: number;
}

export type PromotionEligibilityContext = PromotionEvaluationContext;

export interface PromotionEvaluationResult {
  eligible: boolean;
  reason?: string;
  discountAmount: number;
  finalPrice: number;
  promotion?: Promotion;
}

export type PromotionValidationResult = PromotionEvaluationResult;
