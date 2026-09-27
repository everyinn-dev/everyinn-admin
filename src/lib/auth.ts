import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { Staff } from "@/types";
import { signStaffJwt, verifyStaffJwt, JWT_EXPIRATION_SECONDS } from "./jwt";

export const SESSION_COOKIE_NAME = "everyinn_admin_session";
// 1 Day expiration standard
export const SESSION_DURATION_DAYS = 1;
export const SESSION_DURATION_SECONDS = JWT_EXPIRATION_SECONDS; // 86400s

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Creates a JWT-based session with 1-day expiration.
 * Updates last_login_at in D1 and returns a signed HS256 JWT.
 */
export async function createSession(
  db: D1Database,
  staff: number | { id: number; phone: string; full_name: string; role: "receptionist" | "manager" }
): Promise<string> {
  let staffId: number;
  let staffPhone: string = "";
  let staffName: string = "";
  let staffRole: "receptionist" | "manager" = "receptionist";

  if (typeof staff === "number") {
    staffId = staff;
    const user = await db
      .prepare("SELECT id, phone, full_name, role FROM staff WHERE id = ? LIMIT 1")
      .bind(staffId)
      .first<{ id: number; phone: string; full_name: string; role: "receptionist" | "manager" }>();
    if (user) {
      staffPhone = user.phone;
      staffName = user.full_name;
      staffRole = user.role;
    }
  } else {
    staffId = staff.id;
    staffPhone = staff.phone;
    staffName = staff.full_name;
    staffRole = staff.role;
  }

  // Update last_login_at in database
  await db
    .prepare("UPDATE staff SET last_login_at = datetime('now') WHERE id = ?")
    .bind(staffId)
    .run();

  // Issue 1-day JWT token via Web Crypto API (HS256)
  const token = await signStaffJwt(
    {
      sub: staffId,
      phone: staffPhone,
      fullName: staffName,
      role: staffRole,
    },
    SESSION_DURATION_SECONDS
  );

  return token;
}

export async function destroySession(db: D1Database, token: string): Promise<void> {
  try {
    // If it's a legacy UUID token, remove from staff_sessions table
    if (token && !token.includes(".")) {
      await db
        .prepare("DELETE FROM staff_sessions WHERE token = ?")
        .bind(token)
        .run();
    }
  } catch (err) {
    // Safe ignore error during cleanup
  }
}

/**
 * Retrieves the currently authenticated staff.
 * Priority 1: Fast-path via Web Crypto API verification (HS256) -> ZERO D1 QUERIES & <0.1ms latency!
 * Priority 2: Fallback to D1 staff_sessions table for backwards compatibility with active legacy sessions.
 */
export async function getCurrentStaff(db?: D1Database): Promise<Staff | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    // 1. Fast-path: Verify JWT via Web Crypto API (HS256) - Zero D1 reads!
    const payload = await verifyStaffJwt(token);
    if (payload) {
      return {
        id: payload.sub,
        phone: payload.phone,
        full_name: payload.fullName,
        role: payload.role,
        is_active: 1,
        created_at: new Date((payload.iat || 0) * 1000).toISOString(),
      };
    }

    // 2. Fallback: Legacy UUID session lookup in D1
    if (db && !token.includes(".")) {
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
          role: "receptionist" | "manager";
          is_active: number;
          created_at: string;
          expires_at: string;
        }>();

      if (row) {
        return {
          id: row.id,
          phone: row.phone,
          full_name: row.full_name,
          role: row.role,
          is_active: row.is_active,
          created_at: row.created_at,
        };
      }
    }

    return null;
  } catch (err) {
    console.error("Error in getCurrentStaff:", err);
    return null;
  }
}
