import { bookingCore } from "@/lib/cores";
import type { CoreBookingDto, CoreBookingEnvelope } from "@/lib/coreMappers";
import { derivedKey } from "@/lib/derivedKey";
import { balanceOf, planSettlement } from "@/lib/ledger";
import type { Staff } from "@/types";

export interface SettleOutcome {
  /** The booking to answer with (re-read after the ledger entry). */
  booking: CoreBookingDto;
  /** Amount recorded, 0 when nothing was. */
  settled: number;
  kind: "payment" | "refund" | null;
  /** The price change is committed but the money was NOT recorded: the drawer opens the ledger to do it again. */
  paymentError: string | null;
}

/**
 * Records the money asked for TOGETHER with a price change (edit of a stay, voiding a charge): "Khách trả thêm ngay" /
 * "Hoàn lại khách ngay" (EI-FINANCE-ONTOLOGY-001 §8). Judged against the booking AFTER the change — a payment never
 * above what is still due, a refund never above what the guest holds over the new value. The change stays if the
 * ledger entry fails (Core has no cross-command transaction); the key is derived from the change's key, so a retry
 * of the same intent never records the money twice.
 */
export async function settleAfterChange(args: {
  staff: Staff;
  bookingId: string;
  booking: CoreBookingDto;
  settle: unknown;
  description: { payment: string; refund: string };
  baseKey: string;
}): Promise<SettleOutcome> {
  const { staff, bookingId, booking, settle, description, baseKey } = args;
  const none: SettleOutcome = { booking, settled: 0, kind: null, paymentError: null };
  const kind = settle && typeof settle === "object" ? (settle as { kind?: unknown }).kind : null;
  if (kind !== "payment" && kind !== "refund") return none;
  const after = balanceOf({
    totalPrice: booking.pricing.totalPrice,
    paidAmount: booking.financial.paidAmount,
    refundAmount: booking.financial.refundAmount,
    status: booking.status,
  });
  const plan = planSettlement(settle, after, description[kind]);
  if (plan.kind === "none") return none;
  if (plan.kind === "error") return { ...none, paymentError: plan.error };
  try {
    await bookingCore.post(`/internal/v1/bookings/${encodeURIComponent(bookingId)}/financial-entries`, {
      staff,
      idempotencyKey: derivedKey(baseKey, "settle"),
      body: plan.body,
    });
    const refreshed = await bookingCore.get<CoreBookingEnvelope>(`/internal/v1/bookings/${encodeURIComponent(bookingId)}`, { staff });
    return { booking: refreshed.data?.booking ?? booking, settled: plan.amount, kind: plan.kind, paymentError: null };
  } catch (err) {
    console.error("settleAfterChange: ledger entry not recorded", err);
    return { ...none, paymentError: "Đã lưu thay đổi nhưng CHƯA ghi được khoản thu / hoàn tiền. Vui lòng ghi trong Sổ thu tiền." };
  }
}

export const settledSuffix = (o: Pick<SettleOutcome, "settled" | "kind">): string =>
  o.settled > 0 ? ` Đã ${o.kind === "refund" ? "hoàn" : "ghi thu"} ${o.settled.toLocaleString("vi-VN")} đ.` : "";
