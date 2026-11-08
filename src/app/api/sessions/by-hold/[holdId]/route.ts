import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { coreErrorResponse } from "@/lib/cores";
import { sessionIdForHold } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/sessions/by-hold/[holdId] — deep link for 409 SESSION_MANAGED and wizard restore. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ holdId: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { holdId } = await ctx.params;
    if (!/^[A-Za-z0-9._:-]{3,80}$/.test(holdId)) return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
    return NextResponse.json({ sessionId: await sessionIdForHold(staff, holdId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
