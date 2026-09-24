import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { Staff } from "@/types";

export const SESSION_COOKIE_NAME = "everyinn_admin_session";
export const SESSION_DURATION_DAYS = 7;

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function createSession(db: D1Database, staffId: number): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare("INSERT INTO staff_sessions (token, staff_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, staffId, expiresAt)
    .run();

  await db
    .prepare("UPDATE staff SET last_login_at = datetime('now') WHERE id = ?")
    .bind(staffId)
    .run();

  return token;
}

export async function destroySession(db: D1Database, token: string): Promise<void> {
  await db
    .prepare("DELETE FROM staff_sessions WHERE token = ?")
    .bind(token)
    .run();
}

export async function getCurrentStaff(db: D1Database): Promise<Staff | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const row = await db
      .prepare(
        `SELECT s.id, s.phone, s.full_name, s.role, s.is_active, s.created_at, ss.expires_at
         FROM staff_sessions ss
         JOIN staff s ON s.id = ss.staff_id
         WHERE ss.token = ? AND ss.expires_at > datetime('now') AND s.is_active = 1
         LIMIT 1`
      )
      .bind(token)
      .first<{
        id: number;
        phone: string;
        full_name: string;
        role: 'receptionist' | 'manager';
        is_active: number;
        created_at: string;
        expires_at: string;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      phone: row.phone,
      full_name: row.full_name,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
    };
  } catch (err) {
    console.error("Error in getCurrentStaff:", err);
    return null;
  }
}
