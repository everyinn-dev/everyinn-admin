import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import { intentKey } from "@/lib/bffIdempotency";
import { toLegacyBookingRow, type CoreBookingEnvelope } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** POST /api/bookings/[id]/charges/[chargeId]/void — cancel an incidental charge (reason required). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; chargeId: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id, chargeId } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!reason) {
      return Response.json({ error: "Vui lòng nhập lý do huỷ khoản phát sinh.", code: "REASON_REQUIRED", details: { field: "reason" } }, { status: 400 });
    }
    const current = await bookingCore.get<CoreBookingEnvelope>(`/internal/v1/bookings/${id}`, { staff });
    if (!current.data?.booking) return Response.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    const expectedVersion = Number(body.expectedVersion ?? current.data.booking.control.version);
    const res = await bookingCore.post<CoreBookingEnvelope>(`/internal/v1/bookings/${id}/charges/${encodeURIComponent(chargeId)}/void`, {
      staff,
      idempotencyKey: intentKey(req, "booking-charge-void"),
      body: { expectedVersion, reason },
    });
    if (!res.data?.booking) throw new Error("Không nhận được dữ liệu đặt phòng từ Booking Core.");
    return Response.json({ success: true, message: "Đã huỷ khoản phát sinh.", booking: toLegacyBookingRow(res.data.booking) });
  } catch (error) {
    return toHttpError(error);
  }
}
