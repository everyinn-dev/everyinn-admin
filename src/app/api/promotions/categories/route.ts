import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, newIdempotencyKey } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import {
  toLegacyCategory,
  type CoreCategoryDto,
  type CoreCategoryEnvelope,
} from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/promotions/categories
 * Returns all categories with promotion counts from Booking Core
 */
export async function GET(_req: Request) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coreRes = await bookingCore.get<{ categories: CoreCategoryDto[] }>(
      "/internal/v1/promotion-categories",
      { staff }
    );

    const categories = (coreRes.data?.categories || []).map(toLegacyCategory);
    return Response.json({ categories });
  } catch (error: any) {
    return toHttpError(error);
  }
}

/**
 * POST /api/promotions/categories
 * Create a new promotion category via Booking Core
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
      description,
      icon,
      badge_color,
      badgeColor,
      sort_order,
      sortOrder,
      is_active,
      isActive,
    } = body;

    const coreBody: Record<string, unknown> = {
      name: name?.trim(),
      code: code ? String(code).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_") : "",
    };

    if (description !== undefined) coreBody.description = description ? String(description).trim() : null;
    if (icon !== undefined) coreBody.icon = icon ? String(icon).trim() : "🎁";
    if (badge_color !== undefined || badgeColor !== undefined) {
      coreBody.badgeColor = badge_color || badgeColor || "purple";
    }
    if (sort_order !== undefined || sortOrder !== undefined) {
      coreBody.sortOrder = Number(sort_order ?? sortOrder ?? 0);
    }
    if (is_active !== undefined || isActive !== undefined) {
      coreBody.isActive = is_active !== undefined ? Boolean(is_active) : Boolean(isActive);
    }

    const coreRes = await bookingCore.post<CoreCategoryEnvelope>(
      "/internal/v1/promotion-categories",
      {
        staff,
        idempotencyKey: newIdempotencyKey("promo-cat-create"),
        body: coreBody,
      }
    );

    if (!coreRes.data?.category) {
      throw new Error("Không nhận được dữ liệu danh mục từ Booking Core.");
    }

    return Response.json(
      { success: true, category: toLegacyCategory(coreRes.data.category) },
      { status: 201 }
    );
  } catch (error: any) {
    return toHttpError(error);
  }
}
