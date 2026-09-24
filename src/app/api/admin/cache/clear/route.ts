import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { invalidateAllMasterCache } from "@/lib/masterData";

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff || staff.role !== "manager") {
      return NextResponse.json(
        { error: "Chỉ tài khoản Quản lý (Manager) mới có quyền xóa cache hệ thống." },
        { status: 403 }
      );
    }

    invalidateAllMasterCache();

    return NextResponse.json({
      success: true,
      message: "Đã làm mới (xóa) toàn bộ master data cache thành công.",
    });
  } catch (error: any) {
    console.error("Cache clear error:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi khi xóa cache hệ thống." },
      { status: 500 }
    );
  }
}
