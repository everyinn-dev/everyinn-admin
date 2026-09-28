import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { invalidatePromotionsCache } from "@/lib/masterData";

export const dynamic = "force-dynamic";

/**
 * GET /api/promotions/[id]
 */
export async function GET(
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

    const row = await db
      .prepare(
        `SELECT 
          p.*, 
          c.name as category_name, 
          c.code as category_code, 
          c.icon as category_icon, 
          c.badge_color as category_color
        FROM promotions p
        LEFT JOIN promotion_categories c ON p.category_id = c.id
        WHERE p.id = ? LIMIT 1`
      )
      .bind(id)
      .first<any>();

    if (!row) {
      return NextResponse.json({ error: "Không tìm thấy chương trình ưu đãi." }, { status: 404 });
    }

    const promotion = {
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
    };

    return NextResponse.json({ promotion });
  } catch (error) {
    console.error("GET /api/promotions/[id] error:", error);
    return NextResponse.json({ error: "Lỗi tải thông tin ưu đãi." }, { status: 500 });
  }
}

/**
 * PUT /api/promotions/[id]
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

    if (!name?.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên chương trình ưu đãi." }, { status: 400 });
    }

    const val = Number(discount_value);
    if (isNaN(val) || val <= 0) {
      return NextResponse.json({ error: "Giá trị giảm giá phải lớn hơn 0." }, { status: 400 });
    }

    if (discount_type === "percentage" && val > 100) {
      return NextResponse.json({ error: "Tỷ lệ giảm theo % không được vượt quá 100%." }, { status: 400 });
    }

    // Check duplicate code if provided
    let cleanCode: string | null = null;
    if (code?.trim()) {
      cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      const duplicate = await db
        .prepare("SELECT id FROM promotions WHERE code = ? AND id != ? LIMIT 1")
        .bind(cleanCode, id)
        .first();

      if (duplicate) {
        return NextResponse.json(
          { error: `Mã ưu đãi '${cleanCode}' đã được chương trình khác sử dụng.` },
          { status: 409 }
        );
      }
    }

    const now = new Date().toISOString();

    const res = await db
      .prepare(
        `UPDATE promotions
         SET name = ?, code = ?, category_id = ?, description = ?, discount_type = ?, discount_value = ?,
             max_discount_amount = ?, min_order_amount = ?, applicable_room_classes = ?, applicable_booking_types = ?,
             applicable_loyalty_tiers = ?, applicable_days_of_week = ?, start_date = ?, end_date = ?,
             usage_limit = ?, is_active = ?, updated_by_staff_id = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        name.trim(),
        cleanCode,
        category_id,
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
        now,
        id
      )
      .run();

    if (res.meta.changes === 0) {
      return NextResponse.json({ error: "Không tìm thấy chương trình ưu đãi để cập nhật." }, { status: 404 });
    }

    invalidatePromotionsCache();

    return NextResponse.json({ success: true, message: "Cập nhật ưu đãi thành công." });
  } catch (error) {
    console.error("PUT /api/promotions/[id] error:", error);
    return NextResponse.json({ error: "Không thể cập nhật chương trình ưu đãi." }, { status: 500 });
  }
}

/**
 * PATCH /api/promotions/[id]
 * Toggle is_active status
 */
export async function PATCH(
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
    const { is_active } = body;

    const newActive = is_active ? 1 : 0;
    const now = new Date().toISOString();

    const res = await db
      .prepare(
        `UPDATE promotions
         SET is_active = ?, updated_by_staff_id = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(newActive, staff.id || null, now, id)
      .run();

    if (res.meta.changes === 0) {
      return NextResponse.json({ error: "Không tìm thấy chương trình ưu đãi." }, { status: 404 });
    }

    invalidatePromotionsCache();

    return NextResponse.json({
      success: true,
      is_active: newActive,
      message: newActive ? "Đã kích hoạt ưu đãi." : "Đã tạm dừng ưu đãi.",
    });
  } catch (error) {
    console.error("PATCH /api/promotions/[id] error:", error);
    return NextResponse.json({ error: "Không thể thay đổi trạng thái ưu đãi." }, { status: 500 });
  }
}

/**
 * DELETE /api/promotions/[id]
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

    const res = await db.prepare("DELETE FROM promotions WHERE id = ?").bind(id).run();

    if (res.meta.changes === 0) {
      return NextResponse.json({ error: "Không tìm thấy chương trình ưu đãi để xóa." }, { status: 404 });
    }

    invalidatePromotionsCache();

    return NextResponse.json({ success: true, message: "Xóa chương trình ưu đãi thành công." });
  } catch (error) {
    console.error("DELETE /api/promotions/[id] error:", error);
    return NextResponse.json({ error: "Không thể xóa chương trình ưu đãi." }, { status: 500 });
  }
}
