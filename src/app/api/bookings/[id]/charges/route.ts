import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import { intentKey } from "@/lib/bffIdempotency";
import { describeCharge, type ChargeKind } from "@/lib/charges";
import { toLegacyBookingRow, type CoreBookingEnvelope } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KINDS: readonly ChargeKind[] = ["early_checkin", "late_checkout", "extension", "incidental"];

/**
 * POST /api/bookings/[id]/charges — add a stay charge (+N hours, early check-in, late check-out, incidental).
 * One command; the drawer's quick buttons only preselect the kind. Booking Core prices it and checks availability.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const kind = body.kind as ChargeKind;
    if (!KINDS.includes(kind)) {
      return Response.json({ error: "Vui lòng chọn loại phụ phí.", code: "VALIDATION_FAILED", details: { field: "kind" } }, { status: 400 });
    }
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    const amount = Math.round(Number(body.amount) || 0);
    const hours = Math.round(Number(body.hours) || 0);
    if (kind === "incidental" && amount < 1) {
      return Response.json({ error: "Vui lòng nhập số tiền phát sinh.", code: "VALIDATION_FAILED", details: { field: "amount" } }, { status: 400 });
    }
    if (kind === "incidental" && !reason) {
      return Response.json({ error: "Vui lòng nhập nội dung / lý do khoản phát sinh.", code: "REASON_REQUIRED", details: { field: "reason" } }, { status: 400 });
    }
    const feeOverride = body.feeOverride === undefined || body.feeOverride === null || body.feeOverride === "" ? undefined : Math.max(0, Math.round(Number(body.feeOverride) || 0));

    const current = await bookingCore.get<CoreBookingEnvelope>(`/internal/v1/bookings/${id}`, { staff });
    if (!current.data?.booking) return Response.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    const expectedVersion = Number(body.expectedVersion ?? current.data.booking.control.version);

    const res = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/charges`, {
      staff,
      idempotencyKey: intentKey(req, "booking-charge"),
      body: {
        expectedVersion,
        kind,
        ...(kind === "incidental" ? { amount } : { hours: Math.min(6, Math.max(1, hours || 1)), ...(feeOverride !== undefined ? { feeOverride } : {}) }),
        ...(reason ? { reason } : {}),
      },
    });
    if (!res.data?.booking) throw new Error("Không nhận được dữ liệu đặt phòng từ Booking Core.");
    const added = [...res.data.booking.charges].reverse().find((c) => c.kind === kind && !c.voided);
    return Response.json({
      success: true,
      message: added ? `Đã thêm phụ phí: ${describeCharge(added)}.` : "Đã thêm phụ phí.",
      booking: toLegacyBookingRow(res.data.booking),
    });
  } catch (error) {
    return toHttpError(error);
  }
}
