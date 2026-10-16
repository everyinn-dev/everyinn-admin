import { getDb } from "@/lib/db";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/health
 * Liveness and dependency health probe for Admin BFF, Core bindings, and Admin DB (S2-5).
 */
export async function GET() {
  let db: any = null;
  try {
    db = await getDb();
  } catch {
    db = null;
  }
  const report = await checkHealth({ db });
  return Response.json(report, { status: report.status === "ok" ? 200 : 503 });
}
