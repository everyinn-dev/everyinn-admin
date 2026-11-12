import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import type { ChargeKind, ChargeQuote } from "@/lib/charges";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KINDS: readonly ChargeKind[] = ["early_checkin", "late_checkout", "extension", "incidental"];

/** POST /api/bookings/[id]/charges/quote — what the charge would do (new times, fee, availability, money after). Writes nothing. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const kind = body.kind as ChargeKind;
    if (!KINDS.includes(kind)) return Response.json({ error: "Vui lòng chọn loại phụ phí.", code: "VALIDATION_FAILED" }, { status: 400 });
    const hours = Math.min(6, Math.max(1, Math.round(Number(body.hours) || 1)));
    const amount = Math.max(1, Math.round(Number(body.amount) || 1));
    const feeOverride = body.feeOverride === undefined || body.feeOverride === null || body.feeOverride === "" ? undefined : Math.max(0, Math.round(Number(body.feeOverride) || 0));
    const res = await bookingCore.post<ChargeQuote>(`/internal/v1/bookings/${id}/charges/quote`, {
      staff,
      body: { kind, ...(kind === "incidental" ? { amount } : { hours, ...(feeOverride !== undefined ? { feeOverride } : {}) }) },
    });
    return Response.json({ quote: res.data });
  } catch (error) {
    return toHttpError(error);
  }
}
