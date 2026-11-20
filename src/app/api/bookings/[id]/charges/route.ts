import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import { intentKey } from "@/lib/bffIdempotency";
import { describeCharge, type ChargeKind } from "@/lib/charges";
import { toLegacyBookingRow, type CoreBookingEnvelope } from "@/lib/coreMappers";
import { derivedKey } from "@/lib/derivedKey";
import { planChargePayment } from "@/lib/ledger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KINDS: readonly ChargeKind[] = ["early_checkin", "late_checkout", "extension", "incidental"];

/**
 * POST /api/bookings/[id]/charges — add a stay charge (+N hours, early check-in, late check-out, incidental).
 * One command; the drawer's quick buttons only preselect the kind. Booking Core prices it and checks availability.
 *
 * Optional `collect: { amount, method }` ("Khách đã trả ngay"): after the charge is saved, the money the guest paid is
 * recorded as a ledger payment in the same request (EI-FINANCE-ONTOLOGY-001 §8). The charge stays if the payment
 * fails — the response then carries `paymentError` and the drawer opens the ledger to record it again.
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

    const chargeKey = intentKey(req, "booking-charge");
    const res = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/charges`, {
      staff,
      idempotencyKey: chargeKey,
      body: {
        expectedVersion,
        kind,
        ...(kind === "incidental" ? { amount } : { hours: Math.min(6, Math.max(1, hours || 1)), ...(feeOverride !== undefined ? { feeOverride } : {}) }),
        ...(reason ? { reason } : {}),
      },
    });
    if (!res.data?.booking) throw new Error("Không nhận được dữ liệu đặt phòng từ Booking Core.");
    const added = [...res.data.booking.charges].reverse().find((c) => c.kind === kind && !c.voided);
    let booking = res.data.booking;
    let paymentError: string | null = null;
    let collected = 0;

    // "Khách đã trả ngay": never above what is still due after this charge, whole đồng, only if staff asked for it.
    const pay = planChargePayment(body.collect, toLegacyBookingRow(booking).remaining_amount ?? 0, added ? describeCharge(added) : "phụ phí");
    if (pay.kind === "error") {
      paymentError = pay.error;
    } else if (pay.kind === "pay") {
      try {
        await bookingCore.post(`/internal/v1/bookings/${id}/financial-entries`, {
          staff,
          idempotencyKey: derivedKey(chargeKey, "pay"),
          body: pay.body,
        });
        collected = pay.amount;
        const refreshed = await bookingCore.get<CoreBookingEnvelope>(`/internal/v1/bookings/${id}`, { staff });
        if (refreshed.data?.booking) booking = refreshed.data.booking;
      } catch (err) {
        console.error("POST charge: payment not recorded", err);
        paymentError = "Đã thêm phụ phí nhưng CHƯA ghi được khoản thu tiền. Vui lòng ghi nhận thanh toán trong Sổ thu tiền.";
      }
    }
    const baseMessage = added ? `Đã thêm phụ phí: ${describeCharge(added)}.` : "Đã thêm phụ phí.";
    return Response.json({
      success: true,
      message: collected > 0 ? `${baseMessage} Đã ghi thu ${collected.toLocaleString("vi-VN")} đ.` : baseMessage,
      booking: toLegacyBookingRow(booking),
      paymentError,
    });
  } catch (error) {
    return toHttpError(error);
  }
}
