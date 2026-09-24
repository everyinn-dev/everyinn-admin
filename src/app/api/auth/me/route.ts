import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";

export async function GET() {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);

    if (!staff) {
      return NextResponse.json({ authenticated: false, staff: null }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      staff: {
        id: staff.id,
        phone: staff.phone,
        fullName: staff.full_name,
        role: staff.role,
      },
    });
  } catch (error) {
    console.error("Auth me API error:", error);
    return NextResponse.json({ authenticated: false, staff: null }, { status: 500 });
  }
}
