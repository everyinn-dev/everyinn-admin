import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ValidatePromoResponse {
  valid: boolean;
  reasonCode: string | null;
  reason: string | null;
  discountAmount: number;
  finalPrice: number;
  promotion: {
    id: string;
    name: string;
    code: string | null;
    discountType: string;
    discountValue: number;
    maxDiscountAmount: number | null;
    version: number;
  } | null;
}

/**
 * POST /api/promotions/validate
 * Validates promotion applicability and computes live discount via Booking Core
 */
export async function POST(req: Request) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const pId = body.promotionId || body.promoId;
    const pCode = body.promotionCode || body.promoCode;

    if (!pId && !pCode) {
      return Response.json(
        { error: "Vui lòng cung cấp promoId hoặc promoCode để kiểm tra." },
        { status: 400 }
      );
    }

    const coreBody: Record<string, unknown> = {
      rawSubtotal: Number(body.rawSubtotal ?? 0),
    };
    if (pId) coreBody.promotionId = String(pId).trim();
    if (pCode) coreBody.promotionCode = String(pCode).trim().toUpperCase();

    const phone = body.phone || body.memberPhone;
    if (phone) coreBody.phone = String(phone).trim();
    if (body.roomClass) coreBody.roomClass = body.roomClass;
    if (body.bookingType) coreBody.bookingType = body.bookingType;
    if (body.ratePlanCode) coreBody.ratePlanCode = body.ratePlanCode;
    if (body.checkinAt) coreBody.checkinAt = body.checkinAt;

    const coreRes = await bookingCore.post<ValidatePromoResponse>(
      "/internal/v1/promotions/validate",
      {
        staff,
        body: coreBody,
      }
    );

    return Response.json(coreRes.data);
  } catch (error: any) {
    return toHttpError(error);
  }
}
