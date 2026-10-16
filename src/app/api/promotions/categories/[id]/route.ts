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
 * PUT /api/promotions/categories/[id]
 * Update a promotion category via Booking Core
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    let expectedVersion = body.version ?? body.expectedVersion;

    if (expectedVersion === undefined) {
      const all = await bookingCore.get<{ categories: CoreCategoryDto[] }>(
        "/internal/v1/promotion-categories",
        { staff }
      );
      const match = (all.data?.categories || []).find((c) => c.id === id);
      if (!match) {
        return Response.json(
          { error: "Không tìm thấy danh mục loại ưu đãi để cập nhật." },
          { status: 404 }
        );
      }
      expectedVersion = match.version;
    }

    const coreBody: Record<string, unknown> = {
      expectedVersion: Number(expectedVersion),
    };

    if (body.name !== undefined) coreBody.name = body.name?.trim();
    if (body.description !== undefined) {
      coreBody.description = body.description ? String(body.description).trim() : null;
    }
    if (body.icon !== undefined) coreBody.icon = body.icon ? String(body.icon).trim() : "🎁";
    if (body.badge_color !== undefined || body.badgeColor !== undefined) {
      coreBody.badgeColor = body.badge_color || body.badgeColor || "purple";
    }
    if (body.sort_order !== undefined || body.sortOrder !== undefined) {
      coreBody.sortOrder = Number(body.sort_order ?? body.sortOrder ?? 0);
    }
    if (body.is_active !== undefined || body.isActive !== undefined) {
      coreBody.isActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(body.isActive);
    }

    const coreRes = await bookingCore.patch<CoreCategoryEnvelope>(
      `/internal/v1/promotion-categories/${id}`,
      {
        staff,
        idempotencyKey: newIdempotencyKey("promo-cat-update"),
        body: coreBody,
      }
    );

    if (!coreRes.data?.category) {
      throw new Error("Không nhận được dữ liệu danh mục từ Booking Core.");
    }

    return Response.json({
      success: true,
      message: "Cập nhật loại ưu đãi thành công.",
      category: toLegacyCategory(coreRes.data.category),
    });
  } catch (error: any) {
    return toHttpError(error);
  }
}

/**
 * DELETE /api/promotions/categories/[id]
 * Deactivates category if not in use by any promotion
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const all = await bookingCore.get<{ categories: CoreCategoryDto[] }>(
      "/internal/v1/promotion-categories",
      { staff }
    );
    const match = (all.data?.categories || []).find((c) => c.id === id);
    if (!match) {
      return Response.json(
        { error: "Không tìm thấy danh mục loại ưu đãi để xóa." },
        { status: 404 }
      );
    }

    const promoCount = match.promoCount ?? 0;
    if (promoCount > 0) {
      return Response.json(
        {
          error: `Không thể xóa loại ưu đãi này vì đang có ${promoCount} chương trình ưu đãi thuộc danh mục. Vui lòng chuyển hoặc xóa các ưu đãi trước.`,
        },
        { status: 400 }
      );
    }

    await bookingCore.patch<CoreCategoryEnvelope>(
      `/internal/v1/promotion-categories/${id}`,
      {
        staff,
        idempotencyKey: newIdempotencyKey("promo-cat-delete"),
        body: {
          expectedVersion: match.version,
          isActive: false,
        },
      }
    );

    return Response.json({ success: true, message: "Xóa loại ưu đãi thành công." });
  } catch (error: any) {
    return toHttpError(error);
  }
}
