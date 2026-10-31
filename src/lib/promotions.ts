import {
  Promotion,
  PromotionEvaluationContext,
  PromotionEvaluationResult,
} from "@/types/promotions";
import { getLogicalStayDate } from "./pricing";

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Pure function to evaluate if a promotion is eligible for a given booking context
 * and compute the exact discount amount in VND (strictly on basePrice!).
 */
export function evaluatePromotion(
  promo: Promotion,
  ctx: PromotionEvaluationContext
): PromotionEvaluationResult {
  const basePrice = ctx.basePrice ?? ctx.rawSubtotal ?? 0;

  // 1. Check active status
  if (!promo.is_active) {
    return {
      eligible: false,
      reason: "Chương trình ưu đãi đang tạm dừng.",
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 2. Check usage limit
  if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
    return {
      eligible: false,
      reason: `Đã hết lượt sử dụng (${promo.used_count}/${promo.usage_limit}).`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  if (
    promo.max_uses_per_guest !== null &&
    promo.max_uses_per_guest !== undefined &&
    ctx.guestUsedCount !== undefined &&
    ctx.guestUsedCount >= promo.max_uses_per_guest
  ) {
    return {
      eligible: false,
      reason: `Khách đã dùng tối đa ${promo.max_uses_per_guest} lần mã này.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 3. Check minimum order amount (against basePrice)
  if (promo.min_order_amount > 0 && basePrice < promo.min_order_amount) {
    return {
      eligible: false,
      reason: `Đơn tối thiểu ${promo.min_order_amount.toLocaleString("vi-VN")}đ.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 4. Check room class
  if (
    promo.applicable_room_classes.length > 0 &&
    !promo.applicable_room_classes.includes(ctx.roomClass)
  ) {
    return {
      eligible: false,
      reason: `Chỉ áp dụng cho hạng phòng ${promo.applicable_room_classes.join(", ").toUpperCase()}.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 5. Check booking type
  if (
    promo.applicable_booking_types.length > 0 &&
    !promo.applicable_booking_types.includes(ctx.bookingType)
  ) {
    const typeMap: Record<string, string> = {
      hourly: "Theo giờ",
      overnight: "Qua đêm",
      dayuse: "Theo ngày",
      custom: "Tuỳ chỉnh",
    };
    const allowedLabels = promo.applicable_booking_types.map((t) => typeMap[t] || t).join(", ");
    return {
      eligible: false,
      reason: `Chỉ áp dụng cho hình thức: ${allowedLabels}.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 6. Check loyalty tier
  if (
    promo.applicable_loyalty_tiers.length > 0 &&
    !promo.applicable_loyalty_tiers.includes(ctx.memberTier)
  ) {
    return {
      eligible: false,
      reason: `Yêu cầu hạng thành viên: ${promo.applicable_loyalty_tiers.join(", ").toUpperCase()}.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 7. Check date range (start_date .. end_date) using logical stay date
  const checkinDateStr = getLogicalStayDate(ctx.checkinAt, ctx.bookingType);
  if (promo.start_date && checkinDateStr < promo.start_date) {
    return {
      eligible: false,
      reason: `Áp dụng từ ngày ${promo.start_date}.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }
  if (promo.end_date && checkinDateStr > promo.end_date) {
    return {
      eligible: false,
      reason: `Đã hết hạn từ ngày ${promo.end_date}.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 7b. Check booking window
  const todayYmd = formatYmdLocal(new Date());
  if (promo.booking_window_start && todayYmd < promo.booking_window_start) {
    return {
      eligible: false,
      reason: `Mở đặt từ ngày ${promo.booking_window_start}.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }
  if (promo.booking_window_end && todayYmd > promo.booking_window_end) {
    return {
      eligible: false,
      reason: `Đã đóng cửa sổ đặt ngày ${promo.booking_window_end}.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 7c. Check min nights
  if (promo.min_nights && promo.min_nights > 1 && ctx.checkoutAt) {
    const nights =
      ctx.bookingType === "dayuse"
        ? Math.max(1, Math.round((ctx.checkoutAt.getTime() - ctx.checkinAt.getTime()) / (21 * 3600_000)))
        : 1;
    if (nights < promo.min_nights) {
      return {
        eligible: false,
        reason: `Yêu cầu đặt tối thiểu ${promo.min_nights} đêm.`,
        discountAmount: 0,
        finalPrice: basePrice,
      };
    }
  }

  // 7d. Check blackout dates
  if (promo.blackout_dates && promo.blackout_dates.includes(checkinDateStr)) {
    return {
      eligible: false,
      reason: `Không áp dụng vào ngày lễ/cao điểm (${checkinDateStr}).`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 7e. Check holiday stackability
  if (promo.is_stackable_with_holiday === 0 && ctx.hasHolidaySurcharge) {
    return {
      eligible: false,
      reason: "Không áp dụng đồng thời với phụ thu Lễ/Tết.",
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 8. Check day of week (0 = Sunday .. 6 = Saturday)
  const dayOfWeek = new Date(`${checkinDateStr}T00:00:00`).getDay();
  const applicableDays = promo.applicable_days_of_week || [];
  if (
    applicableDays.length > 0 &&
    !applicableDays.includes(dayOfWeek)
  ) {
    const dayLabels: Record<number, string> = {
      0: "CN",
      1: "T2",
      2: "T3",
      3: "T4",
      4: "T5",
      5: "T6",
      6: "T7",
    };
    const allowedDays = applicableDays.map((d) => dayLabels[d]).join(", ");
    return {
      eligible: false,
      reason: `Chỉ áp dụng các ngày: ${allowedDays}.`,
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  // 9. Calculate discount amount strictly on basePrice
  let discountAmount = 0;
  if (promo.discount_type === "percentage") {
    discountAmount = Math.round((basePrice * promo.discount_value) / 100);
    if (promo.max_discount_amount && promo.max_discount_amount > 0) {
      discountAmount = Math.min(discountAmount, promo.max_discount_amount);
    }
  } else {
    discountAmount = Math.round(promo.discount_value);
  }

  discountAmount = Math.min(discountAmount, basePrice);

  return {
    eligible: true,
    discountAmount,
    finalPrice: Math.max(0, basePrice - discountAmount),
  };
}
