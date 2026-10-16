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

function requirePromo(envelope: CorePromotionEnvelope | null): CorePromotionDto {
  if (!envelope?.promotion) {
    throw new Error("Không nhận được dữ liệu ưu đãi từ Booking Core.");
  }
  return envelope.promotion;
}

/**
 * GET /api/promotions/[id]
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coreRes = await bookingCore.get<CorePromotionEnvelope>(
      `/internal/v1/promotions/${id}`,
      { staff }
    );

    const promo = requirePromo(coreRes.data);
    return Response.json({ promotion: toLegacyPromotion(promo) });
  } catch (error: any) {
    return toHttpError(error);
  }
}

/**
 * PUT /api/promotions/[id]
 * Full update of promotion fields via Booking Core
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    let expectedVersion = body.version ?? body.expectedVersion;

    if (expectedVersion === undefined) {
      const current = await bookingCore.get<CorePromotionEnvelope>(
        `/internal/v1/promotions/${id}`,
        { staff }
      );
      expectedVersion = requirePromo(current.data).version;
    }

    const coreBody: Record<string, unknown> = {
      expectedVersion: Number(expectedVersion),
    };

    if (body.name !== undefined) coreBody.name = body.name?.trim();
    if (body.category_id !== undefined || body.categoryId !== undefined) {
      coreBody.categoryId = (body.category_id || body.categoryId)?.trim();
    }
    if (body.code !== undefined) {
      coreBody.code = body.code ? String(body.code).trim().toUpperCase() : "";
    }
    if (body.description !== undefined) {
      coreBody.description = body.description ? String(body.description).trim() : "";
    }
    if (body.discount_type !== undefined || body.discountType !== undefined) {
      coreBody.discountType = body.discount_type || body.discountType;
    }
    if (body.discount_value !== undefined || body.discountValue !== undefined) {
      coreBody.discountValue = Number(body.discount_value ?? body.discountValue);
    }
    if (body.max_discount_amount !== undefined || body.maxDiscountAmount !== undefined) {
      const v = body.max_discount_amount ?? body.maxDiscountAmount;
      coreBody.maxDiscountAmount = v !== null && v !== "" ? Number(v) : null;
    }
    if (body.min_order_amount !== undefined || body.minOrderAmount !== undefined) {
      coreBody.minOrderAmount = Number(body.min_order_amount ?? body.minOrderAmount ?? 0);
    }
    if (body.applicable_room_classes || body.applicableRoomClasses) {
      coreBody.applicableRoomClasses = body.applicable_room_classes || body.applicableRoomClasses;
    }
    if (body.applicable_booking_types || body.applicableBookingTypes) {
      coreBody.applicableBookingTypes = body.applicable_booking_types || body.applicableBookingTypes;
    }
    if (body.applicable_rate_plan_codes || body.applicableRatePlanCodes) {
      coreBody.applicableRatePlanCodes = body.applicable_rate_plan_codes || body.applicableRatePlanCodes;
    }
    if (body.applicable_loyalty_tiers || body.applicableLoyaltyTiers) {
      coreBody.applicableLoyaltyTiers = body.applicable_loyalty_tiers || body.applicableLoyaltyTiers;
    }
    if (body.applicable_days_of_week || body.applicableDaysOfWeek) {
      coreBody.applicableDaysOfWeek = body.applicable_days_of_week || body.applicableDaysOfWeek;
    }
    if (body.start_date !== undefined || body.startDate !== undefined) {
      coreBody.startDate = body.start_date || body.startDate || null;
    }
    if (body.end_date !== undefined || body.endDate !== undefined) {
      coreBody.endDate = body.end_date || body.endDate || null;
    }
    if (body.usage_limit !== undefined || body.usageLimit !== undefined) {
      const u = body.usage_limit ?? body.usageLimit;
      coreBody.usageLimit = u !== null && u !== "" ? Number(u) : null;
    }
    if (body.is_active !== undefined || body.isActive !== undefined) {
      coreBody.isActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(body.isActive);
    }

    const coreRes = await bookingCore.patch<CorePromotionEnvelope>(
      `/internal/v1/promotions/${id}`,
      {
        staff,
        idempotencyKey: newIdempotencyKey("promo-update"),
        body: coreBody,
      }
    );

    const updated = requirePromo(coreRes.data);
    return Response.json({
      success: true,
      message: "Cập nhật ưu đãi thành công.",
      promotion: toLegacyPromotion(updated),
    });
  } catch (error: any) {
    return toHttpError(error);
  }
}

/**
 * PATCH /api/promotions/[id]
 * Toggle is_active status via Booking Core
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    let expectedVersion = body.version ?? body.expectedVersion;

    if (expectedVersion === undefined) {
      const current = await bookingCore.get<CorePromotionEnvelope>(
        `/internal/v1/promotions/${id}`,
        { staff }
      );
      expectedVersion = requirePromo(current.data).version;
    }

    const newActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(body.isActive);

    const coreRes = await bookingCore.patch<CorePromotionEnvelope>(
      `/internal/v1/promotions/${id}`,
      {
        staff,
        idempotencyKey: newIdempotencyKey("promo-toggle"),
        body: {
          expectedVersion: Number(expectedVersion),
          isActive: newActive,
        },
      }
    );

    const updated = requirePromo(coreRes.data);
    const updatedActive = updated.isActive ? 1 : 0;
    return Response.json({
      success: true,
      is_active: updatedActive,
      message: updatedActive ? "Đã kích hoạt ưu đãi." : "Đã tạm dừng ưu đãi.",
      promotion: toLegacyPromotion(updated),
    });
  } catch (error: any) {
    return toHttpError(error);
  }
}

/**
 * DELETE /api/promotions/[id]
 * Archive promotion in Booking Core
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const current = await bookingCore.get<CorePromotionEnvelope>(
      `/internal/v1/promotions/${id}`,
      { staff }
    );
    const currentPromo = requirePromo(current.data);

    await bookingCore.post<CorePromotionEnvelope>(
      `/internal/v1/promotions/${id}/archive`,
      {
        staff,
        idempotencyKey: newIdempotencyKey("promo-archive"),
        body: { expectedVersion: currentPromo.version },
      }
    );

    return Response.json({ success: true, message: "Xóa chương trình ưu đãi thành công." });
  } catch (error: any) {
    return toHttpError(error);
  }
}
