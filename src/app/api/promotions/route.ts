import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { invalidatePromotionsCache } from "@/lib/masterData";

export const dynamic = "force-dynamic";

/**
 * GET /api/promotions
 * Query params: category_id, status (all, active, expired, inactive), search, active_only
 */
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("category_id")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "all";
    const search = searchParams.get("search")?.trim() || "";
    const activeOnly = searchParams.get("active_only") === "true";

    let query = `
      SELECT 
        p.*, 
        c.name as category_name, 
        c.code as category_code, 
        c.icon as category_icon, 
        c.badge_color as category_color
      FROM promotions p
      LEFT JOIN promotion_categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const bindings: any[] = [];

    if (activeOnly) {
      query += ` AND p.is_active = 1`;
    }

    if (categoryId) {
      query += ` AND p.category_id = ?`;
      bindings.push(categoryId);
    }

    if (status === "active") {
      const todayStr = new Date().toISOString().slice(0, 10);
      query += ` AND p.is_active = 1 AND (p.end_date IS NULL OR p.end_date >= ?)`;
      bindings.push(todayStr);
    } else if (status === "expired") {
      const todayStr = new Date().toISOString().slice(0, 10);
      query += ` AND p.end_date IS NOT NULL AND p.end_date < ?`;
      bindings.push(todayStr);
    } else if (status === "inactive") {
      query += ` AND p.is_active = 0`;
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)`;
      const pattern = `%${search}%`;
      bindings.push(pattern, pattern, pattern);
    }

    query += ` ORDER BY p.is_active DESC, p.created_at DESC`;

    const stmt = db.prepare(query);
    const boundStmt = bindings.length > 0 ? stmt.bind(...bindings) : stmt;
    const { results } = await boundStmt.all<any>();

    const promotions = (results || []).map((row) => ({
      ...row,
      applicable_room_classes:
        typeof row.applicable_room_classes === "string"
          ? JSON.parse(row.applicable_room_classes)
          : row.applicable_room_classes || [],
      applicable_booking_types:
        typeof row.applicable_booking_types === "string"
          ? JSON.parse(row.applicable_booking_types)
          : row.applicable_booking_types || [],
      applicable_loyalty_tiers:
        typeof row.applicable_loyalty_tiers === "string"
          ? JSON.parse(row.applicable_loyalty_tiers)
          : row.applicable_loyalty_tiers || [],
      applicable_days_of_week:
        typeof row.applicable_days_of_week === "string"
          ? JSON.parse(row.applicable_days_of_week)
          : row.applicable_days_of_week || [0, 1, 2, 3, 4, 5, 6],
    }));

    return NextResponse.json({ promotions });
  } catch (error) {
    console.error("GET /api/promotions error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách ưu đãi." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/promotions
 * Create a new promotion
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
      name,
      code,
      category_id,
      description,
      discount_type = "percentage",
      discount_value,
      max_discount_amount,
      min_order_amount = 0,
      applicable_room_classes = ["haven", "signature"],
      applicable_booking_types = ["hourly", "overnight", "dayuse", "custom"],
      applicable_loyalty_tiers = ["new", "bronze", "silver", "gold"],
      applicable_days_of_week = [0, 1, 2, 3, 4, 5, 6],
      start_date,
      end_date,
      usage_limit,
      is_active = 1,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên chương trình ưu đãi." }, { status: 400 });
    }
    if (!category_id) {
      return NextResponse.json({ error: "Vui lòng chọn danh mục loại ưu đãi." }, { status: 400 });
    }

    const val = Number(discount_value);
    if (isNaN(val) || val <= 0) {
      return NextResponse.json({ error: "Giá trị giảm giá phải lớn hơn 0." }, { status: 400 });
    }

    if (discount_type === "percentage" && val > 100) {
      return NextResponse.json({ error: "Tỷ lệ giảm theo % không được vượt quá 100%." }, { status: 400 });
    }

    // Format & validate code if provided
    let cleanCode: string | null = null;
    if (code?.trim()) {
      cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      // Check duplicate code
      const duplicate = await db
        .prepare("SELECT id FROM promotions WHERE code = ? LIMIT 1")
        .bind(cleanCode)
        .first();

      if (duplicate) {
        return NextResponse.json(
          { error: `Mã ưu đãi '${cleanCode}' đã tồn tại.` },
          { status: 409 }
        );
      }
    }

    // Verify category exists
    const cat = await db
      .prepare("SELECT id FROM promotion_categories WHERE id = ? LIMIT 1")
      .bind(category_id)
      .first();

    if (!cat) {
      return NextResponse.json({ error: "Danh mục loại ưu đãi không tồn tại." }, { status: 404 });
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const promoId = cleanCode ? `PROMO-${cleanCode}` : `PROMO-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO promotions (
          id, category_id, name, code, description, discount_type, discount_value, max_discount_amount,
          min_order_amount, applicable_room_classes, applicable_booking_types, applicable_loyalty_tiers,
          applicable_days_of_week, start_date, end_date, usage_limit, used_count, is_active,
          created_by_staff_id, updated_by_staff_id, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, 0, ?,
          ?, ?, ?, ?
        )`
      )
      .bind(
        promoId,
        category_id,
        name.trim(),
        cleanCode,
        description?.trim() || null,
        discount_type,
        val,
        max_discount_amount ? Number(max_discount_amount) : null,
        Number(min_order_amount) || 0,
        JSON.stringify(applicable_room_classes),
        JSON.stringify(applicable_booking_types),
        JSON.stringify(applicable_loyalty_tiers),
        JSON.stringify(applicable_days_of_week),
        start_date?.trim() || null,
        end_date?.trim() || null,
        usage_limit ? Number(usage_limit) : null,
        is_active ? 1 : 0,
        staff.id || null,
        staff.id || null,
        now,
        now
      )
      .run();

    invalidatePromotionsCache();

    return NextResponse.json({
      success: true,
      message: "Tạo ưu đãi thành công.",
      promotionId: promoId,
    });
  } catch (error) {
    console.error("POST /api/promotions error:", error);
    return NextResponse.json(
      { error: "Không thể tạo chương trình ưu đãi." },
      { status: 500 }
    );
  }
}
