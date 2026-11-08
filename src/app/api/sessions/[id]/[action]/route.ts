import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { coreErrorResponse } from "@/lib/cores";
import { clientIdemKey, landingBaseUrl, sessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const ACTIONS = ["payments", "confirm", "reject", "revoke", "accept-short", "request-topup", "restore", "share-link", "preview"] as const;
type Action = (typeof ACTIONS)[number];

/**
 * POST /api/sessions/[id]/[action] — staff decisions on a booking session (same commands as the Telegram buttons;
 * the staff member logged in is the actor in every audit row). share-link returns the guest payment link.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; action: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, action } = await ctx.params;
    if (!/^ses_[a-f0-9]{16}$/.test(id) || !(ACTIONS as readonly string[]).includes(action)) return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 404 });
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (action === "payments") {
      const amount = Math.round(Number(body.amount) || 0);
      if (amount <= 0) return NextResponse.json({ error: "Nhập số tiền đã nhận." }, { status: 400 });
      body = { amount, method: body.method ?? "bank_transfer" };
    }
    const r = await sessions.action(staff, id, action as Action, body, clientIdemKey(req));
    if (action === "share-link" && r.data?.path) {
      return NextResponse.json({ ...r.data, url: `${await landingBaseUrl()}${r.data.path}` }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(r.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
