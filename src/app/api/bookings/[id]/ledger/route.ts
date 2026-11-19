import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import { intentKey } from "@/lib/bffIdempotency";
import { toLegacyBookingRow, type CoreBookingEnvelope } from "@/lib/coreMappers";
import { ENTRY_LABELS, planLedgerAction, type LedgerEntry } from "@/lib/ledger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/bookings/[id]/ledger — the booking's money movements (append-only, oldest first). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const res = await bookingCore.get<{ entries: LedgerEntry[] }>(`/internal/v1/bookings/${encodeURIComponent(id)}/financial-entries`, { staff });
    return Response.json({ entries: res.data?.entries ?? [] }, { headers: NO_STORE });
  } catch (error) {
    return toHttpError(error);
  }
}

/**
 * POST /api/bookings/[id]/ledger — record money that actually moved (EI-FINANCE-ONTOLOGY-001 §8):
 * payment | refund | adjustment (manager) | reverse (manager). Each carries the method and WHEN it moved.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const plan = planLedgerAction((await req.json()) as Record<string, unknown>);
    if (!plan.ok) return Response.json({ error: plan.error, code: "VALIDATION_FAILED", details: { field: plan.field } }, { status: 400 });
    if ((plan.kind === "reverse" || plan.body.entryType === "adjustment") && staff.role !== "manager") {
      return Response.json({ error: "Chỉ quản lý được điều chỉnh hoặc đảo bút toán.", code: "FORBIDDEN_ROLE" }, { status: 403 });
    }

    const base = `/internal/v1/bookings/${encodeURIComponent(id)}/financial-entries`;
    const res =
      plan.kind === "reverse"
        ? await bookingCore.post<CoreBookingEnvelope & { entry: LedgerEntry }>(`${base}/${encodeURIComponent(plan.entryId)}/reverse`, {
            staff,
            idempotencyKey: intentKey(req, "booking-ledger-reverse"),
            body: plan.body,
          })
        : await bookingCore.post<CoreBookingEnvelope & { entry: LedgerEntry }>(base, {
            staff,
            idempotencyKey: intentKey(req, "booking-ledger"),
            body: plan.body,
          });
    const entry = res.data?.entry ?? null;
    const label = entry ? ENTRY_LABELS[entry.entryType] : "Bút toán";
    return Response.json(
      {
        success: true,
        message: `Đã ghi ${label.toLowerCase()} ${Math.abs(entry?.amount ?? 0).toLocaleString("vi-VN")} đ.`,
        entry,
        booking: res.data?.booking ? toLegacyBookingRow(res.data.booking) : null,
      },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    return toHttpError(error);
  }
}
