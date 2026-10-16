import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, newIdempotencyKey } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import {
  toLegacyPromotion,
  type CorePromotionDto,
  type CorePromotionEnvelope,
} from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/promotions
 * Query params: category_id, status (all, active, expired, inactive, archived), search, active_only
 */
export async function GET(req: Request) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("category_id")?.trim() || searchParams.get("categoryId")?.trim();
    let status = searchParams.get("status")?.trim() || "all";
    if (searchParams.get("active_only") === "true") {
      status = "active";
    }
    const search = searchParams.get("search")?.trim();

    const query: Record<string, string> = { status };
    if (categoryId && categoryId !== "all") query.categoryId = categoryId;
    if (search) query.search = search;

    const coreRes = await bookingCore.get<{ promotions: CorePromotionDto[] }>(
      "/internal/v1/promotions",
      { staff, query }
    );

    const promotions = (coreRes.data?.promotions || []).map(toLegacyPromotion);
    return Response.json({ promotions });
  } catch (error: any) {
    return toHttpError(error);
  }
}

/**
 * POST /api/promotions
 * Create a new promotion via Booking Core
 */
export async function POST(req: Request) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const {
      name,
      code,
      category_id,
      categoryId,
      description,
      discount_type,
      discountType,
      discount_value,
      discountValue,
      max_discount_amount,
      maxDiscountAmount,
      min_order_amount,
      minOrderAmount,
      applicable_room_classes,
      applicableRoomClasses,
      applicable_booking_types,
      applicableBookingTypes,
      applicable_rate_plan_codes,
      applicableRatePlanCodes,
      applicable_loyalty_tiers,
      applicableLoyaltyTiers,
      applicable_days_of_week,
      applicableDaysOfWeek,
      start_date,
      startDate,
      end_date,
      endDate,
      usage_limit,
      usageLimit,
      is_active,
      isActive,
    } = body;

    const coreBody: Record<string, unknown> = {
      name: name?.trim(),
      categoryId: (category_id || categoryId)?.trim(),
      discountType: discount_type || discountType || "percentage",
      discountValue: Number(discount_value ?? discountValue),
    };

    if (code) coreBody.code = String(code).trim().toUpperCase();
    if (description !== undefined) coreBody.description = description ? String(description).trim() : null;
    if (max_discount_amount !== undefined || maxDiscountAmount !== undefined) {
      const v = max_discount_amount ?? maxDiscountAmount;
      coreBody.maxDiscountAmount = v !== null && v !== "" ? Number(v) : null;
    }
    if (min_order_amount !== undefined || minOrderAmount !== undefined) {
      coreBody.minOrderAmount = Number(min_order_amount ?? minOrderAmount ?? 0);
    }
    if (applicable_room_classes || applicableRoomClasses) {
      coreBody.applicableRoomClasses = applicable_room_classes || applicableRoomClasses;
    }
    if (applicable_booking_types || applicableBookingTypes) {
      coreBody.applicableBookingTypes = applicable_booking_types || applicableBookingTypes;
    }
    if (applicable_rate_plan_codes || applicableRatePlanCodes) {
      coreBody.applicableRatePlanCodes = applicable_rate_plan_codes || applicableRatePlanCodes;
    }
    if (applicable_loyalty_tiers || applicableLoyaltyTiers) {
      coreBody.applicableLoyaltyTiers = applicable_loyalty_tiers || applicableLoyaltyTiers;
    }
    if (applicable_days_of_week || applicableDaysOfWeek) {
      coreBody.applicableDaysOfWeek = applicable_days_of_week || applicableDaysOfWeek;
    }
    if (start_date || startDate) coreBody.startDate = start_date || startDate;
    if (end_date || endDate) coreBody.endDate = end_date || endDate;
    if (usage_limit !== undefined || usageLimit !== undefined) {
      const u = usage_limit ?? usageLimit;
      coreBody.usageLimit = u !== null && u !== "" ? Number(u) : null;
    }
    if (is_active !== undefined || isActive !== undefined) {
      coreBody.isActive = is_active !== undefined ? Boolean(is_active) : Boolean(isActive);
    }

    const coreRes = await bookingCore.post<CorePromotionEnvelope>(
      "/internal/v1/promotions",
      {
        staff,
        idempotencyKey: newIdempotencyKey("promo-create"),
        body: coreBody,
      }
    );

    if (!coreRes.data?.promotion) {
      throw new Error("Không nhận được dữ liệu ưu đãi từ Booking Core.");
    }

    const promotion = toLegacyPromotion(coreRes.data.promotion);
    return Response.json(
      { success: true, promotion },
      { status: 201 }
    );
  } catch (error: any) {
    return toHttpError(error);
  }
}
