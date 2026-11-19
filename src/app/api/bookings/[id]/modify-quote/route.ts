import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FIELDS = ["roomId", "checkinAt", "checkoutAt", "earlyCheckinHours", "lateCheckoutHours", "numGuests", "customPrice", "dropPromotion"] as const;

/**
 * POST /api/bookings/[id]/modify-quote — both prices of a stay edit from Booking Core (EI-FINANCE-ONTOLOGY-001 Q2):
 * keep the agreed price vs today's rates, and the balance against money already received. Read-only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const input = (await req.json()) as Record<string, unknown>;
    const body: Record<string, unknown> = {};
    for (const k of FIELDS) if (input[k] !== undefined && input[k] !== null && input[k] !== "") body[k] = input[k];
    const res = await bookingCore.post(`/internal/v1/bookings/${encodeURIComponent(id)}/modify-quote`, { staff, body });
    return Response.json(res.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toHttpError(error);
  }
}
