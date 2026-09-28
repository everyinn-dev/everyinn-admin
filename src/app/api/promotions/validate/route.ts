import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { lookupMember } from "@/lib/cdp";
import { evaluatePromotion } from "@/lib/promotions";
import { BookingType, LoyaltyTier, RoomClass } from "@/types";
import { Promotion } from "@/types/promotions";

export const dynamic = "force-dynamic";

/**
 * POST /api/promotions/validate
 * Validates promotion applicability and computes live discount for a booking
 */
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const {
      promoId,
      promoCode,
      roomClass = "haven",
      bookingType = "hourly",
      checkinAt,
      rawSubtotal = 0,
      memberPhone,
      memberTier: inputMemberTier,
    } = body;

    if (!promoId && !promoCode) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp promoId hoặc promoCode để kiểm tra." },
        { status: 400 }
      );
    }

    let promoRow: any = null;

    if (promoId) {
      promoRow = await db
        .prepare(
          `SELECT p.*, c.name as category_name, c.code as category_code, c.icon as category_icon, c.badge_color as category_color
           FROM promotions p
           LEFT JOIN promotion_categories c ON p.category_id = c.id
           WHERE p.id = ? LIMIT 1`
        )
        .bind(promoId)
        .first();
    } else if (promoCode) {
      const cleanCode = promoCode.trim().toUpperCase();
      promoRow = await db
        .prepare(
          `SELECT p.*, c.name as category_name, c.code as category_code, c.icon as category_icon, c.badge_color as category_color
           FROM promotions p
           LEFT JOIN promotion_categories c ON p.category_id = c.id
           WHERE p.code = ? LIMIT 1`
        )
        .bind(cleanCode)
        .first();
    }

    if (!promoRow) {
      return NextResponse.json(
        {
          valid: false,
          reason: "Mã ưu đãi không tồn tại hoặc không hợp lệ.",
          discountAmount: 0,
          finalPrice: Number(rawSubtotal) || 0,
        },
        { status: 404 }
      );
    }

    const promotion: Promotion = {
      ...promoRow,
      applicable_room_classes:
        typeof promoRow.applicable_room_classes === "string"
          ? JSON.parse(promoRow.applicable_room_classes)
          : promoRow.applicable_room_classes || [],
      applicable_booking_types:
        typeof promoRow.applicable_booking_types === "string"
          ? JSON.parse(promoRow.applicable_booking_types)
          : promoRow.applicable_booking_types || [],
      applicable_loyalty_tiers:
        typeof promoRow.applicable_loyalty_tiers === "string"
          ? JSON.parse(promoRow.applicable_loyalty_tiers)
          : promoRow.applicable_loyalty_tiers || [],
      applicable_days_of_week:
        typeof promoRow.applicable_days_of_week === "string"
          ? JSON.parse(promoRow.applicable_days_of_week)
          : promoRow.applicable_days_of_week || [0, 1, 2, 3, 4, 5, 6],
    };

    // Determine customer loyalty tier
    let effectiveTier: LoyaltyTier = (inputMemberTier as LoyaltyTier) || "new";
    if (memberPhone && (!inputMemberTier || inputMemberTier === "new")) {
      const member = await lookupMember(db, memberPhone);
      if (member?.loyalty_tier) {
        effectiveTier = member.loyalty_tier;
      }
    }

    const checkinDate = checkinAt ? new Date(checkinAt) : new Date();

    const result = evaluatePromotion(promotion, {
      roomClass: roomClass as RoomClass,
      bookingType: bookingType as BookingType,
      checkinAt: checkinDate,
      rawSubtotal: Number(rawSubtotal) || 0,
      memberTier: effectiveTier,
    });

    return NextResponse.json({
      valid: result.eligible,
      reason: result.reason,
      discountAmount: result.discountAmount,
      finalPrice: result.finalPrice,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        code: promotion.code,
        categoryName: promotion.category_name,
        categoryIcon: promotion.category_icon,
        categoryColor: promotion.category_color,
        discountType: promotion.discount_type,
        discountValue: promotion.discount_value,
        maxDiscountAmount: promotion.max_discount_amount,
      },
    });
  } catch (error) {
    console.error("POST /api/promotions/validate error:", error);
    return NextResponse.json(
      { error: "Lỗi trong quá trình kiểm tra ưu đãi." },
      { status: 500 }
    );
  }
}
