import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { coreErrorResponse } from "@/lib/cores";
import { sessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/sessions?status=live&channel=web — booking sessions (web + admin), ETag passthrough. */
export async function GET(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const q = req.nextUrl.searchParams;
    const r = await sessions.list(staff, { status: q.get("status") ?? undefined, channel: q.get("channel") ?? undefined }, req.headers.get("if-none-match"));
    if (r.status === 304) return new NextResponse(null, { status: 304, headers: { etag: r.etag ?? "" } });
    return NextResponse.json(r.data, { headers: { "Cache-Control": "no-store", ...(r.etag ? { etag: r.etag } : {}) } });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
