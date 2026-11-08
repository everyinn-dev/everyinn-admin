import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { coreErrorResponse } from "@/lib/cores";
import { sessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const ID = /^ses_[a-f0-9]{16}$/;

/** GET /api/sessions/[id] — session + audit timeline + payments (ETag = session version). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    if (!ID.test(id)) return NextResponse.json({ error: "Không tìm thấy phiên." }, { status: 404 });
    const r = await sessions.get(staff, id, req.headers.get("if-none-match"));
    if (r.status === 304) return new NextResponse(null, { status: 304, headers: { etag: r.etag ?? "" } });
    return NextResponse.json(r.data, { headers: { "Cache-Control": "no-store", ...(r.etag ? { etag: r.etag } : {}) } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
