import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { getCurrentStaff, SESSION_COOKIE_NAME } from "@/lib/auth";
import { verifyStaffJwt } from "@/lib/jwt";

export async function GET() {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);

    if (!staff) {
      return NextResponse.json({ authenticated: false, staff: null }, { status: 401 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const payload = token ? await verifyStaffJwt(token) : null;
    const expiresAt = payload?.exp ? payload.exp * 1000 : Date.now() + 86400 * 1000;

    return NextResponse.json({
      authenticated: true,
      staff: {
        id: staff.id,
        phone: staff.phone,
        fullName: staff.full_name,
        role: staff.role,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Auth me API error:", error);
    return NextResponse.json({ authenticated: false, staff: null }, { status: 500 });
  }
}
