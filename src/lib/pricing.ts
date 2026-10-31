import {
  BookingType,
  CappingWarning,
  NightlyBreakdownItem,
  PricingRule,
  RoomClass,
  SurchargeRule,
} from "@/types";

export interface PricingCalculationInput {
  bookingType: BookingType;
  roomClass: RoomClass;
  checkinAt: Date;
  checkoutAt: Date;
  earlyCheckinHours?: number;
  lateCheckoutHours?: number;
  numGuests?: number;
  pricingRules: PricingRule[];
  surchargeRules?: SurchargeRule[];
  customPrice?: number;
  discountAmount?: number;
}

export interface PricingBreakdown {
  basePrice: number;
  holidaySurcharge: number;
  extraGuestFee: number;
  extraHours: number;
  earlyCheckinHours: number;
  lateCheckoutHours: number;
  extraHourFee: number;
  totalExtraFee: number;
  discountAmount: number;
  totalPrice: number;
  durationHours: number;
  nightsCount: number;
  comboLabel: string;
  durationLabel: string;
  nightlyBreakdown: NightlyBreakdownItem[];
  cappingWarning: CappingWarning | null;
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Quy tắc 00:00-12:00 của ca Qua đêm:
 * Nếu khách check-in lúc 00:00–05:59 sáng ngày D, tính thuộc đêm lưu trú (Stay Date) ngày D-1.
 */
export function getLogicalStayDate(checkinAt: Date, bookingType: BookingType): string {
  const d = new Date(checkinAt.getTime());
  if (bookingType === "overnight" && d.getHours() >= 0 && d.getHours() < 6) {
    d.setDate(d.getDate() - 1);
  }
  return formatYmdLocal(d);
}

export function enumerateStayDates(
  checkinAt: Date,
  checkoutAt: Date,
  bookingType: BookingType,
  earlyCheckinHours = 0,
  lateCheckoutHours = 0
): string[] {
  const firstStayDate = getLogicalStayDate(checkinAt, bookingType);
  if (bookingType === "hourly" || bookingType === "overnight") {
    return [firstStayDate];
  }
  const stdCheckinMs = checkinAt.getTime() + earlyCheckinHours * 3600_000;
  const stdCheckoutMs = checkoutAt.getTime() - lateCheckoutHours * 3600_000;
  const rawNights = Math.max(1, Math.round((stdCheckoutMs - stdCheckinMs) / (21 * 3600_000)));
  const dates: string[] = [];
  const base = new Date(`${firstStayDate}T00:00:00`);
  for (let i = 0; i < rawNights; i++) {
    const cur = new Date(base.getTime());
    cur.setDate(cur.getDate() + i);
    dates.push(formatYmdLocal(cur));
  }
  return dates;
}

function findMatchingHolidayRule(
  stayDate: string,
  roomClass: RoomClass,
  bookingType: BookingType,
  surchargeRules: SurchargeRule[]
): SurchargeRule | null {
  const dow = new Date(`${stayDate}T00:00:00`).getDay();
  const candidates = surchargeRules.filter((r) => {
    if (!r.is_active || r.surcharge_type !== "holiday") return false;
    if (!r.applicable_room_classes.includes(roomClass)) return false;
    if (!r.applicable_booking_types.includes(bookingType)) return false;
    if (!r.applicable_days_of_week.includes(dow)) return false;
    if (r.start_date && stayDate < r.start_date) return false;
    if (r.end_date && stayDate > r.end_date) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0];
}

function computeExtraGuestFee(
  numGuests: number,
  nightsCount: number,
  roomClass: RoomClass,
  bookingType: BookingType,
  surchargeRules: SurchargeRule[]
): number {
  const rule = surchargeRules.find(
    (r) =>
      r.is_active &&
      r.surcharge_type === "extra_guest" &&
      r.applicable_room_classes.includes(roomClass) &&
      r.applicable_booking_types.includes(bookingType)
  );
  const threshold = rule ? rule.guest_threshold : 2;
  const feePerGuestNight = rule ? rule.amount : 150000;
  const extraGuests = Math.max(0, numGuests - threshold);
  if (extraGuests <= 0) return 0;
  return Math.round(extraGuests * feePerGuestNight * Math.max(1, nightsCount));
}

/**
 * Pure function to calculate room pricing based on Every Inn's business rules v2.0.
 */
export function calculatePrice(input: PricingCalculationInput): PricingBreakdown {
  const {
    bookingType,
    roomClass,
    checkinAt,
    checkoutAt,
    earlyCheckinHours = 0,
    lateCheckoutHours = 0,
    numGuests = 2,
    pricingRules,
    surchargeRules = [],
    customPrice = 0,
    discountAmount = 0,
  } = input;

  const diffMs = checkoutAt.getTime() - checkinAt.getTime();
  const totalHours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

  // 1. Custom booking type
  if (bookingType === "custom") {
    const base = Math.max(0, customPrice);
    const finalTotal = Math.max(0, base - discountAmount);
    return {
      basePrice: base,
      holidaySurcharge: 0,
      extraGuestFee: 0,
      extraHours: 0,
      earlyCheckinHours: 0,
      lateCheckoutHours: 0,
      extraHourFee: 0,
      totalExtraFee: 0,
      discountAmount,
      totalPrice: finalTotal,
      durationHours: totalHours,
      nightsCount: 1,
      comboLabel: "Tuỳ chỉnh",
      durationLabel: `${totalHours} giờ`,
      nightlyBreakdown: [],
      cappingWarning: null,
    };
  }

  const rule = pricingRules.find(
    (r) => r.room_class === roomClass && r.booking_type === bookingType
  );

  if (!rule) {
    throw new Error(`Không tìm thấy quy tắc giá cho hạng phòng ${roomClass} - ${bookingType}`);
  }

  const stayDates = enumerateStayDates(
    checkinAt,
    checkoutAt,
    bookingType,
    earlyCheckinHours,
    lateCheckoutHours
  );
  const nightsCount = Math.max(1, stayDates.length);

  // 2. Hourly booking (Combo 3h + extra hours)
  if (bookingType === "hourly") {
    const effectiveHours = Math.max(3, totalHours);
    const baseDuration = rule.base_duration_hours ?? 3;
    const extraHours = Math.max(0, effectiveHours - baseDuration);
    const totalExtraFee = extraHours * rule.extra_hour_fee;

    const stayDate = stayDates[0];
    const hRule = findMatchingHolidayRule(stayDate, roomClass, "hourly", surchargeRules);
    const holidaySurcharge = hRule
      ? hRule.calc_mode === "percentage"
        ? Math.round((rule.base_price * hRule.amount) / 100)
        : Math.round(hRule.amount)
      : 0;

    const extraGuestFee = computeExtraGuestFee(numGuests, 1, roomClass, "hourly", surchargeRules);
    const subtotalBeforeDiscount = rule.base_price + holidaySurcharge + totalExtraFee + extraGuestFee;

    // Soft Capping Advisory against Overnight / Dayuse base price
    const overnightRule = pricingRules.find((r) => r.room_class === roomClass && r.booking_type === "overnight");
    const dayuseRule = pricingRules.find((r) => r.room_class === roomClass && r.booking_type === "dayuse");
    const hourlyTotal = rule.base_price + totalExtraFee;
    let cappingWarning: CappingWarning | null = null;

    if (overnightRule && hourlyTotal > overnightRule.base_price) {
      const saving = hourlyTotal - overnightRule.base_price;
      cappingWarning = {
        exceeded: true,
        currentSubtotal: hourlyTotal,
        suggestedBookingType: "overnight",
        suggestedBasePrice: overnightRule.base_price,
        savingAmount: saving,
        message: `Giá theo giờ (${hourlyTotal.toLocaleString("vi-VN")}đ) đang cao hơn gói Qua đêm (${overnightRule.base_price.toLocaleString("vi-VN")}đ) là ${saving.toLocaleString("vi-VN")}đ.`,
      };
    } else if (dayuseRule && hourlyTotal > dayuseRule.base_price) {
      const saving = hourlyTotal - dayuseRule.base_price;
      cappingWarning = {
        exceeded: true,
        currentSubtotal: hourlyTotal,
        suggestedBookingType: "dayuse",
        suggestedBasePrice: dayuseRule.base_price,
        savingAmount: saving,
        message: `Giá theo giờ (${hourlyTotal.toLocaleString("vi-VN")}đ) đang cao hơn gói Theo ngày (${dayuseRule.base_price.toLocaleString("vi-VN")}đ) là ${saving.toLocaleString("vi-VN")}đ.`,
      };
    }

    const totalPrice = Math.max(0, subtotalBeforeDiscount - discountAmount);

    return {
      basePrice: rule.base_price,
      holidaySurcharge,
      extraGuestFee,
      extraHours,
      earlyCheckinHours: 0,
      lateCheckoutHours: 0,
      extraHourFee: rule.extra_hour_fee,
      totalExtraFee,
      discountAmount,
      totalPrice,
      durationHours: effectiveHours,
      nightsCount: 1,
      comboLabel: extraHours > 0 ? `Combo 3h + ${extraHours}h` : "Combo 3h",
      durationLabel: `${effectiveHours} giờ`,
      nightlyBreakdown: [
        {
          stayDate,
          baseRate: rule.base_price,
          holidayRuleId: hRule?.id ?? null,
          holidayRuleName: hRule?.name ?? null,
          holidaySurchargePercent: hRule && hRule.calc_mode === "percentage" ? hRule.amount : 0,
          holidaySurchargeAmount: holidaySurcharge,
        },
      ],
      cappingWarning,
    };
  }

  // 3. Overnight booking (12h package + early checkin / late checkout)
  if (bookingType === "overnight") {
    const earlyH = Math.max(0, earlyCheckinHours);
    const lateH = Math.max(0, lateCheckoutHours);
    const extraHours = earlyH + lateH;
    const totalExtraFee = extraHours * rule.extra_hour_fee;

    const stayDate = stayDates[0];
    const hRule = findMatchingHolidayRule(stayDate, roomClass, "overnight", surchargeRules);
    const holidaySurcharge = hRule
      ? hRule.calc_mode === "percentage"
        ? Math.round((rule.base_price * hRule.amount) / 100)
        : Math.round(hRule.amount)
      : 0;

    const extraGuestFee = computeExtraGuestFee(numGuests, 1, roomClass, "overnight", surchargeRules);
    const totalPrice = Math.max(
      0,
      rule.base_price + holidaySurcharge + totalExtraFee + extraGuestFee - discountAmount
    );

    const parts: string[] = ["Qua đêm (12h)"];
    if (earlyH > 0) parts.push(`Sớm ${earlyH}h`);
    if (lateH > 0) parts.push(`Muộn ${lateH}h`);

    return {
      basePrice: rule.base_price,
      holidaySurcharge,
      extraGuestFee,
      extraHours,
      earlyCheckinHours: earlyH,
      lateCheckoutHours: lateH,
      extraHourFee: rule.extra_hour_fee,
      totalExtraFee,
      discountAmount,
      totalPrice,
      durationHours: 12 + extraHours,
      nightsCount: 1,
      comboLabel: parts.join(" + "),
      durationLabel: `${12 + extraHours} giờ`,
      nightlyBreakdown: [
        {
          stayDate,
          baseRate: rule.base_price,
          holidayRuleId: hRule?.id ?? null,
          holidayRuleName: hRule?.name ?? null,
          holidaySurchargePercent: hRule && hRule.calc_mode === "percentage" ? hRule.amount : 0,
          holidaySurchargeAmount: holidaySurcharge,
        },
      ],
      cappingWarning: null,
    };
  }

  // 4. Dayuse booking (15:00 -> 12:00 next day per night + early/late hours)
  const earlyH = Math.max(0, earlyCheckinHours);
  const lateH = Math.max(0, lateCheckoutHours);
  const extraHours = earlyH + lateH;

  let basePrice = 0;
  let holidaySurcharge = 0;
  const nightlyBreakdown: NightlyBreakdownItem[] = [];

  for (const sDate of stayDates) {
    const hRule = findMatchingHolidayRule(sDate, roomClass, "dayuse", surchargeRules);
    const hAmount = hRule
      ? hRule.calc_mode === "percentage"
        ? Math.round((rule.base_price * hRule.amount) / 100)
        : Math.round(hRule.amount)
      : 0;
    basePrice += rule.base_price;
    holidaySurcharge += hAmount;
    nightlyBreakdown.push({
      stayDate: sDate,
      baseRate: rule.base_price,
      holidayRuleId: hRule?.id ?? null,
      holidayRuleName: hRule?.name ?? null,
      holidaySurchargePercent: hRule && hRule.calc_mode === "percentage" ? hRule.amount : 0,
      holidaySurchargeAmount: hAmount,
    });
  }

  const totalExtraFee = extraHours * rule.extra_hour_fee;
  const extraGuestFee = computeExtraGuestFee(numGuests, nightsCount, roomClass, "dayuse", surchargeRules);
  const totalPrice = Math.max(
    0,
    basePrice + holidaySurcharge + totalExtraFee + extraGuestFee - discountAmount
  );

  const labelParts: string[] = [`Theo ngày (${nightsCount} đêm)`];
  if (earlyH > 0) labelParts.push(`Sớm ${earlyH}h`);
  if (lateH > 0) labelParts.push(`Muộn ${lateH}h`);

  return {
    basePrice,
    holidaySurcharge,
    extraGuestFee,
    extraHours,
    earlyCheckinHours: earlyH,
    lateCheckoutHours: lateH,
    extraHourFee: rule.extra_hour_fee,
    totalExtraFee,
    discountAmount,
    totalPrice,
    durationHours: totalHours,
    nightsCount,
    comboLabel: labelParts.join(" + "),
    durationLabel: `${nightsCount} ngày đêm${extraHours > 0 ? ` (+${extraHours}h)` : ""}`,
    nightlyBreakdown,
    cappingWarning: null,
  };
}

/**
 * Helper to generate hourly check-in time slots (8:00 to 21:00)
 */
export const DEFAULT_HOURLY_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

/**
 * Standard Overnight Shifts
 */
export const OVERNIGHT_START_HOURS = [
  { hour: 21, label: "21:00 → 09:00 sáng hôm sau" },
  { hour: 22, label: "22:00 → 10:00 sáng hôm sau" },
  { hour: 23, label: "23:00 → 11:00 sáng hôm sau" },
  { hour: 24, label: "00:00 (24h) → 12:00 trưa hôm sau" },
];
