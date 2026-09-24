import { BookingType, PricingRule, RoomClass } from "@/types";

export interface PricingBreakdown {
  bookingType: BookingType;
  roomClass: RoomClass;
  comboKey: 'combo3h' | 'combo6h' | 'overnight' | 'dayroom';
  comboLabel: string;
  basePrice: number;
  durationLabel: string;
  extraHours: number;
  extraHourFee: number;
  totalExtraFee: number;
  discountAmount: number;
  totalPrice: number;
}

export const EXTRA_HOUR_FEE = 60000;

export const DEFAULT_PRICING: Record<RoomClass, Record<'combo3h' | 'combo6h' | 'overnight' | 'dayroom', number>> = {
  haven: {
    combo3h: 320000,
    combo6h: 450000,
    overnight: 500000,
    dayroom: 650000,
  },
  signature: {
    combo3h: 370000,
    combo6h: 520000,
    overnight: 580000,
    dayroom: 750000,
  },
};

export function resolveHourlyCombo(hours: number): {
  comboKey: 'combo3h' | 'combo6h';
  comboLabel: string;
  extraHours: number;
} {
  const roundedHours = Math.max(3, Math.round(hours));
  if (roundedHours < 6) {
    // 3, 4, 5 hours -> combo 3h + (hours - 3) extra
    return {
      comboKey: 'combo3h',
      comboLabel: 'Combo 3 Giờ',
      extraHours: roundedHours - 3,
    };
  } else {
    // 6, 7, 8, ... hours -> combo 6h + (hours - 6) extra
    return {
      comboKey: 'combo6h',
      comboLabel: 'Combo 6 Giờ',
      extraHours: roundedHours - 6,
    };
  }
}

export function calculatePrice(params: {
  bookingType: BookingType;
  roomClass: RoomClass;
  checkinAt: Date;
  checkoutAt: Date;
  lateCheckoutHours?: number;
  pricingRules?: PricingRule[];
  discountAmount?: number;
}): PricingBreakdown {
  const {
    bookingType,
    roomClass,
    checkinAt,
    checkoutAt,
    lateCheckoutHours = 0,
    pricingRules,
    discountAmount = 0,
  } = params;

  // Helper to get rule price or fallback
  const getBase = (typeKey: 'combo3h' | 'combo6h' | 'overnight' | 'dayroom'): number => {
    if (pricingRules && pricingRules.length > 0) {
      const match = pricingRules.find(
        (r) => r.room_class === roomClass && r.booking_type === typeKey && r.is_active === 1
      );
      if (match) return match.base_price;
    }
    return DEFAULT_PRICING[roomClass][typeKey];
  };

  const getExtraHourFee = (): number => {
    if (pricingRules && pricingRules.length > 0) {
      const match = pricingRules.find((r) => r.room_class === roomClass && r.is_active === 1);
      if (match) return match.extra_hour_fee;
    }
    return EXTRA_HOUR_FEE;
  };

  const extraUnitFee = getExtraHourFee();

  if (bookingType === 'hourly') {
    const diffMs = checkoutAt.getTime() - checkinAt.getTime();
    const durationHours = Math.max(3, Math.round(diffMs / (1000 * 60 * 60)));
    const { comboKey, comboLabel, extraHours } = resolveHourlyCombo(durationHours);
    const basePrice = getBase(comboKey);
    const totalExtraFee = extraHours * extraUnitFee;
    const totalPrice = Math.max(0, basePrice + totalExtraFee - discountAmount);

    return {
      bookingType,
      roomClass,
      comboKey,
      comboLabel,
      basePrice,
      durationLabel: `${durationHours} Giờ (${comboLabel}${extraHours > 0 ? ` + ${extraHours}h thêm` : ''})`,
      extraHours,
      extraHourFee: extraUnitFee,
      totalExtraFee,
      discountAmount,
      totalPrice,
    };
  }

  if (bookingType === 'overnight') {
    const basePrice = getBase('overnight');
    const validLateHours = Math.min(6, Math.max(0, lateCheckoutHours));
    const totalExtraFee = validLateHours * extraUnitFee;
    const totalPrice = Math.max(0, basePrice + totalExtraFee - discountAmount);

    return {
      bookingType,
      roomClass,
      comboKey: 'overnight',
      comboLabel: 'Combo Qua Đêm (12 Giờ)',
      basePrice,
      durationLabel: `Qua đêm 12h${validLateHours > 0 ? ` + ${validLateHours}h trễ` : ''}`,
      extraHours: validLateHours,
      extraHourFee: extraUnitFee,
      totalExtraFee,
      discountAmount,
      totalPrice,
    };
  }

  // Day use (Theo ngày)
  const diffTime = checkoutAt.getTime() - checkinAt.getTime();
  const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
  const unitDayPrice = getBase('dayroom');
  const basePrice = unitDayPrice * diffDays;
  const validLateHours = Math.min(6, Math.max(0, lateCheckoutHours));
  const totalExtraFee = validLateHours * extraUnitFee;
  const totalPrice = Math.max(0, basePrice + totalExtraFee - discountAmount);

  return {
    bookingType,
    roomClass,
    comboKey: 'dayroom',
    comboLabel: `Theo Ngày (${diffDays} đêm)`,
    basePrice,
    durationLabel: `${diffDays} đêm${validLateHours > 0 ? ` + ${validLateHours}h trễ` : ''}`,
    extraHours: validLateHours,
    extraHourFee: extraUnitFee,
    totalExtraFee,
    discountAmount,
    totalPrice,
  };
}
