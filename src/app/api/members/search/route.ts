import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { cdpCore, coreErrorResponse } from "@/lib/cores";
import { toMemberSearchHit, type CoreCustomerSearchHit } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Returning-guest typeahead for the create-booking forms: name / Instagram / Facebook / Zalo / phone prefix.
 * POST (query in the body) so names and phone fragments never land in URLs or access logs.
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { q?: unknown } | null;
    const q = typeof body?.q === "string" ? body.q.trim() : "";
    if (q.length < 2) return NextResponse.json({ error: "Nhập ít nhất 2 ký tự để tìm khách.", code: "QUERY_TOO_SHORT" }, { status: 400 });
    if (q.length > 80) return NextResponse.json({ error: "Từ khóa quá dài.", code: "VALIDATION_FAILED" }, { status: 400 });

    const res = await cdpCore.post<{ results: CoreCustomerSearchHit[] }>("/internal/v1/customers/search", { staff, body: { q, limit: 8 } });
    return NextResponse.json({ results: (res.data?.results ?? []).map(toMemberSearchHit) });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
