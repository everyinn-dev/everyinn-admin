import {
  Promotion,
  PromotionEligibilityContext,
  PromotionValidationResult,
} from "@/types/promotions";

/**
 * Validate whether a promotion is applicable to a specific booking context
 */
export function validatePromotionEligibility(
  promotion: Promotion,
  context: PromotionEligibilityContext
): { eligible: boolean; reason?: string } {
  // 1. Is active
  if (!promotion.is_active) {
    return { eligible: false, reason: "Chương trình ưu đãi đang tạm dừng." };
  }

  // 2. Usage limit
  if (
    promotion.usage_limit !== null &&
    promotion.usage_limit !== undefined &&
    promotion.used_count >= promotion.usage_limit
  ) {
    return { eligible: false, reason: "Mã ưu đãi đã hết lượt sử dụng." };
  }

  // 3. Time validity (start_date & end_date)
  // Format checkinAt to YYYY-MM-DD
  const checkinIso = context.checkinAt.toISOString();
  const checkinDateStr = checkinIso.slice(0, 10);

  if (promotion.start_date && checkinDateStr < promotion.start_date) {
    return {
      eligible: false,
      reason: `Ưu đãi bắt đầu áp dụng từ ngày ${promotion.start_date}.`,
    };
  }

  if (promotion.end_date && checkinDateStr > promotion.end_date) {
    return {
      eligible: false,
      reason: `Ưu đãi đã hết hạn từ ngày ${promotion.end_date}.`,
    };
  }

  // 4. Days of week [0..6] (0 = Chủ Nhật, 1 = Thứ Hai... 6 = Thứ Bảy)
  if (
    Array.isArray(promotion.applicable_days_of_week) &&
    promotion.applicable_days_of_week.length > 0
  ) {
    const dayOfWeek = context.checkinAt.getDay();
    if (!promotion.applicable_days_of_week.includes(dayOfWeek)) {
      const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      const allowedNames = promotion.applicable_days_of_week.map((d) => dayNames[d]).join(", ");
      return {
        eligible: false,
        reason: `Ưu đãi chỉ áp dụng vào các ngày: ${allowedNames}.`,
      };
    }
  }

  // 5. Room class
  if (
    Array.isArray(promotion.applicable_room_classes) &&
    promotion.applicable_room_classes.length > 0
  ) {
    if (!promotion.applicable_room_classes.includes(context.roomClass)) {
      return {
        eligible: false,
        reason: `Chỉ áp dụng cho hạng phòng: ${promotion.applicable_room_classes.join(", ").toUpperCase()}.`,
      };
    }
  }

  // 6. Booking type
  if (
    Array.isArray(promotion.applicable_booking_types) &&
    promotion.applicable_booking_types.length > 0
  ) {
    if (!promotion.applicable_booking_types.includes(context.bookingType)) {
      const typeLabels: Record<string, string> = {
        hourly: "Theo Giờ",
        overnight: "Qua Đêm",
        dayuse: "Theo Ngày",
        custom: "Tuỳ Chỉnh",
      };
      const allowedLabels = promotion.applicable_booking_types
        .map((t) => typeLabels[t] || t)
        .join(", ");
      return {
        eligible: false,
        reason: `Chỉ áp dụng cho hình thức đặt: ${allowedLabels}.`,
      };
    }
  }

  // 7. Loyalty tier (Mini CDP)
  if (
    Array.isArray(promotion.applicable_loyalty_tiers) &&
    promotion.applicable_loyalty_tiers.length > 0
  ) {
    const userTier = context.memberTier || "new";
    if (!promotion.applicable_loyalty_tiers.includes(userTier)) {
      const tierLabels: Record<string, string> = {
        new: "Khách Mới",
        bronze: "Bronze",
        silver: "Silver",
        gold: "Gold",
      };
      const allowedTiers = promotion.applicable_loyalty_tiers
        .map((t) => tierLabels[t] || t)
        .join(", ");
      return {
        eligible: false,
        reason: `Đặc quyền ưu đãi dành riêng cho hạng: ${allowedTiers}.`,
      };
    }
  }

  // 8. Min order amount
  if (promotion.min_order_amount > 0 && context.rawSubtotal < promotion.min_order_amount) {
    return {
      eligible: false,
      reason: `Đơn phòng tối thiểu ${promotion.min_order_amount.toLocaleString("vi-VN")} đ để áp dụng ưu đãi này.`,
    };
  }

  return { eligible: true };
}

/**
 * Compute the discount amount and final price for an eligible promotion
 */
export function computePromotionDiscount(
  promotion: Promotion,
  rawSubtotal: number
): { discountAmount: number; finalPrice: number } {
  if (rawSubtotal <= 0) {
    return { discountAmount: 0, finalPrice: 0 };
  }

  let discount = 0;

  if (promotion.discount_type === "percentage") {
    const pct = Math.max(0, Math.min(100, promotion.discount_value));
    const rawDiscount = Math.round((rawSubtotal * pct) / 100);

    if (
      promotion.max_discount_amount !== null &&
      promotion.max_discount_amount !== undefined &&
      promotion.max_discount_amount > 0
    ) {
      discount = Math.min(rawDiscount, promotion.max_discount_amount);
    } else {
      discount = rawDiscount;
    }
  } else {
    // fixed_amount
    discount = Math.max(0, promotion.discount_value);
  }

  // Discount cannot exceed subtotal
  discount = Math.min(rawSubtotal, discount);
  const finalPrice = Math.max(0, rawSubtotal - discount);

  return { discountAmount: discount, finalPrice };
}

/**
 * Convenience helper to validate and compute discount in one pass
 */
export function evaluatePromotion(
  promotion: Promotion,
  context: PromotionEligibilityContext
): PromotionValidationResult {
  const eligibility = validatePromotionEligibility(promotion, context);

  if (!eligibility.eligible) {
    return {
      eligible: false,
      reason: eligibility.reason,
      discountAmount: 0,
      finalPrice: context.rawSubtotal,
      promotion,
    };
  }

  const { discountAmount, finalPrice } = computePromotionDiscount(promotion, context.rawSubtotal);

  return {
    eligible: true,
    discountAmount,
    finalPrice,
    promotion,
  };
}
