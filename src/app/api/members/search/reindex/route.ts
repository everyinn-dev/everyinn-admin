import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { cdpCore, coreErrorResponse } from "@/lib/cores";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Pages per call: keeps one request well under the Workers subrequest cap (30 customers per page). */
const MAX_PAGES = 20;

/**
 * Manager-only maintenance: (re)build the CDP returning-guest search index. Run once after CDP
 * migration 0005, after a legacy backfill or a D1 restore. Idempotent; call again with
 * `{ after: nextCursor }` while `done` is false.
 */
export async function POST(req: Request) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (staff.role !== "manager") return NextResponse.json({ error: "Chỉ quản lý được chạy tác vụ này.", code: "MANAGER_REQUIRED" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as { after?: unknown } | null;
    let after: string | null = typeof body?.after === "string" && body.after ? body.after : null;
    let indexed = 0;
    let pages = 0;
    do {
      const res = await cdpCore.post<{ indexed: number; nextCursor: string | null }>("/internal/v1/maintenance/search-reindex", {
        staff,
        body: after ? { after } : {},
      });
      indexed += res.data?.indexed ?? 0;
      after = res.data?.nextCursor ?? null;
      pages += 1;
    } while (after && pages < MAX_PAGES);

    return NextResponse.json({ indexed, pages, done: after === null, nextCursor: after });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
