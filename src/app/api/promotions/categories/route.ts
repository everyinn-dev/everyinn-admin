import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { invalidatePromotionsCache } from "@/lib/masterData";

export const dynamic = "force-dynamic";

/**
 * GET /api/promotions/categories
 * Returns all categories with promotion counts
 */
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { results } = await db
      .prepare(
        `SELECT 
          c.id, c.name, c.code, c.description, c.icon, c.badge_color, c.sort_order, c.is_active, c.created_at, c.updated_at,
          COUNT(p.id) as promo_count
         FROM promotion_categories c
         LEFT JOIN promotions p ON c.id = p.category_id
         GROUP BY c.id
         ORDER BY c.sort_order ASC, c.name ASC`
      )
      .all<any>();

    return NextResponse.json({ categories: results || [] });
  } catch (error) {
    console.error("GET /api/promotions/categories error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh mục loại ưu đãi." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/promotions/categories
 * Create a new promotion category
 */
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const { name, code, description, icon = "🎁", badge_color = "purple", sort_order = 0, is_active = 1 } = body;

    if (!name?.trim() || !code?.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên loại ưu đãi và mã code phân loại." },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const categoryId = `cat_${cleanCode}`;

    // Check duplicate code
    const existing = await db
      .prepare("SELECT id FROM promotion_categories WHERE code = ? OR id = ? LIMIT 1")
      .bind(cleanCode, categoryId)
      .first();

    if (existing) {
      return NextResponse.json(
        { error: `Mã loại ưu đãi '${cleanCode}' đã tồn tại.` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO promotion_categories (
          id, name, code, description, icon, badge_color, sort_order, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        categoryId,
        name.trim(),
        cleanCode,
        description?.trim() || null,
        icon.trim() || "🎁",
        badge_color,
        Number(sort_order) || 0,
        is_active ? 1 : 0,
        now,
        now
      )
      .run();

    invalidatePromotionsCache();

    return NextResponse.json({
      success: true,
      category: {
        id: categoryId,
        name: name.trim(),
        code: cleanCode,
        description: description?.trim() || null,
        icon: icon.trim() || "🎁",
        badge_color,
        sort_order: Number(sort_order) || 0,
        is_active: is_active ? 1 : 0,
        promo_count: 0,
      },
    });
  } catch (error) {
    console.error("POST /api/promotions/categories error:", error);
    return NextResponse.json(
      { error: "Không thể tạo loại ưu đãi mới." },
      { status: 500 }
    );
  }
}
