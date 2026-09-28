import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { invalidatePromotionsCache } from "@/lib/masterData";

export const dynamic = "force-dynamic";

/**
 * PUT /api/promotions/categories/[id]
 * Update a promotion category
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const { name, code, description, icon, badge_color, sort_order, is_active } = body;

    if (!name?.trim() || !code?.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên loại ưu đãi và mã code phân loại." },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

    // Check if code is used by another category
    const duplicate = await db
      .prepare("SELECT id FROM promotion_categories WHERE code = ? AND id != ? LIMIT 1")
      .bind(cleanCode, id)
      .first();

    if (duplicate) {
      return NextResponse.json(
        { error: `Mã loại ưu đãi '${cleanCode}' đã được danh mục khác sử dụng.` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const res = await db
      .prepare(
        `UPDATE promotion_categories
         SET name = ?, code = ?, description = ?, icon = ?, badge_color = ?, sort_order = ?, is_active = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        name.trim(),
        cleanCode,
        description?.trim() || null,
        icon?.trim() || "🎁",
        badge_color || "purple",
        Number(sort_order) || 0,
        is_active ? 1 : 0,
        now,
        id
      )
      .run();

    if (res.meta.changes === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy danh mục loại ưu đãi để cập nhật." },
        { status: 404 }
      );
    }

    invalidatePromotionsCache();

    return NextResponse.json({ success: true, message: "Cập nhật loại ưu đãi thành công." });
  } catch (error) {
    console.error("PUT /api/promotions/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật loại ưu đãi." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/promotions/categories/[id]
 * Delete a category if not in use
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if there are promotions assigned to this category
    const countRow = await db
      .prepare("SELECT COUNT(*) as cnt FROM promotions WHERE category_id = ?")
      .bind(id)
      .first<{ cnt: number }>();

    if (countRow && countRow.cnt > 0) {
      return NextResponse.json(
        {
          error: `Không thể xóa loại ưu đãi này vì đang có ${countRow.cnt} chương trình ưu đãi thuộc danh mục. Vui lòng chuyển hoặc xóa các ưu đãi trước.`,
        },
        { status: 400 }
      );
    }

    const res = await db
      .prepare("DELETE FROM promotion_categories WHERE id = ?")
      .bind(id)
      .run();

    if (res.meta.changes === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy danh mục loại ưu đãi để xóa." },
        { status: 404 }
      );
    }

    invalidatePromotionsCache();

    return NextResponse.json({ success: true, message: "Xóa loại ưu đãi thành công." });
  } catch (error) {
    console.error("DELETE /api/promotions/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Không thể xóa loại ưu đãi." },
      { status: 500 }
    );
  }
}
