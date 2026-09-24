import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_DAYS, verifyPassword } from "@/lib/auth";
import { logEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = (await req.json()) as { phone?: string; password?: string };

    if (!phone || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập số điện thoại và mật khẩu." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const cleanPhone = phone.trim();

    const staffUser = await db
      .prepare("SELECT * FROM staff WHERE phone = ? AND is_active = 1 LIMIT 1")
      .bind(cleanPhone)
      .first<{
        id: number;
        phone: string;
        password_hash: string;
        full_name: string;
        role: 'receptionist' | 'manager';
      }>();

    if (!staffUser) {
      return NextResponse.json(
        { error: "Số điện thoại hoặc mật khẩu không chính xác." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, staffUser.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Số điện thoại hoặc mật khẩu không chính xác." },
        { status: 401 }
      );
    }

    const sessionToken = await createSession(db, staffUser.id);
    await logEvent(db, "STAFF_LOGIN", "staff", String(staffUser.id), { phone: cleanPhone }, staffUser.id);

    const response = NextResponse.json({
      success: true,
      staff: {
        id: staffUser.id,
        phone: staffUser.phone,
        fullName: staffUser.full_name,
        role: staffUser.role,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
