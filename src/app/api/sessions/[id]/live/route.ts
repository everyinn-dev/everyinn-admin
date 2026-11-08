import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { agentCore, coreErrorResponse } from "@/lib/cores";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/sessions/[id]/live?v= — long-poll (≤ 25 s) through the session Durable Object; 304 when unchanged. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    if (!/^ses_[a-f0-9]{16}$/.test(id)) return NextResponse.json({ error: "Không tìm thấy phiên." }, { status: 404 });
    const v = Math.max(0, Number(req.nextUrl.searchParams.get("v") ?? "0") || 0);
    const r = await agentCore.get(`/internal/v1/sessions/${id}/live`, { staff, query: { v, timeout: 25000 }, timeoutMs: 30_000, maxAttempts: 1 });
    if (r.status === 304) return new NextResponse(null, { status: 304 });
    return NextResponse.json(r.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
