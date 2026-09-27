/**
 * Lightweight, zero-dependency JWT implementation for Cloudflare Workers & Edge runtime
 * using standard Web Crypto API (crypto.subtle with HMAC-SHA256).
 */

export interface StaffJwtPayload {
  sub: number; // staff_id
  phone: string;
  fullName: string;
  role: "receptionist" | "manager";
  iat?: number;
  exp?: number;
}

// 1 Day expiration standard (24 hours = 86400 seconds)
export const JWT_EXPIRATION_SECONDS = 24 * 60 * 60;

const DEFAULT_SECRET = "everyinn_jwt_secret_vanhanh_2026_d1_edge_super_key";

function getSecretKey(): string {
  if (typeof process !== "undefined" && process.env?.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  return DEFAULT_SECRET;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Sign a Staff JWT token with 1-day expiration (HS256)
 */
export async function signStaffJwt(
  payload: StaffJwtPayload,
  expiresInSeconds: number = JWT_EXPIRATION_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: StaffJwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(fullPayload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const key = await getHmacKey(getSecretKey());
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(unsignedToken));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));

  return `${unsignedToken}.${signatureB64}`;
}

/**
 * Verify a Staff JWT token and extract its payload. Returns null if invalid or expired.
 */
export async function verifyStaffJwt(token: string): Promise<StaffJwtPayload | null> {
  try {
    if (!token || typeof token !== "string") return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const unsignedToken = `${headerB64}.${payloadB64}`;

    const enc = new TextEncoder();
    const key = await getHmacKey(getSecretKey());
    const signature = base64UrlDecode(signatureB64);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature as any,
      enc.encode(unsignedToken)
    );

    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as StaffJwtPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}
