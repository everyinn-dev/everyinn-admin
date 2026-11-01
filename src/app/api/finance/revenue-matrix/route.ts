import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import type { RevenueMatrix } from "@/types/finance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /api/finance/revenue-matrix?from=YYYY-MM&to=YYYY-MM — room × month revenue pivot.
 * Aggregation happens in Booking Core (single grouped D1 query, manager-only); Admin just proxies with ETag support.
 */
export async function GET(req: Request) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from")?.trim() || undefined;
    const to = searchParams.get("to")?.trim() || undefined;
    for (const [name, v] of [["from", from], ["to", to]] as const) {
      if (v && !MONTH_RE.test(v)) {
        return Response.json({ error: `Tham số '${name}' phải có dạng YYYY-MM.` }, { status: 400 });
      }
    }

    const res = await bookingCore.get<RevenueMatrix>("/internal/v1/finance/revenue-matrix", {
      staff,
      query: { from, to },
      ifNoneMatch: req.headers.get("if-none-match"),
    });

    if (res.status === 304) {
      return new Response(null, {
        status: 304,
        headers: { ...(res.etag ? { ETag: res.etag } : {}), "Cache-Control": "no-cache" },
      });
    }
    if (!res.data) throw new Error("Không nhận được báo cáo doanh thu từ Booking Core.");

    return Response.json(res.data, { headers: { ...NO_CACHE_HEADERS, ...(res.etag ? { ETag: res.etag } : {}) } });
  } catch (error) {
    return toHttpError(error);
  }
}

