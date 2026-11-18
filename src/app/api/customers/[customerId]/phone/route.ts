import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { intentKey } from "@/lib/bffIdempotency";
import { cdpCore, coreErrorResponse } from "@/lib/cores";
import { toLegacyMemberResponse, type CoreCustomer } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CUSTOMER_ID = /^cus_[A-Za-z0-9-]{8,64}$/;

/**
 * Manager-only: move a guest profile to a new phone number. CDP keeps the same customer (tier, stamps,
 * vouchers, booking history) and retires the old number. The Core enforces the role too.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (staff.role !== "manager") return NextResponse.json({ error: "Chỉ quản lý được đổi số điện thoại khách.", code: "MANAGER_REQUIRED" }, { status: 403 });

    const { customerId } = await params;
    if (!CUSTOMER_ID.test(customerId)) return NextResponse.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });

    const body = (await req.json().catch(() => null)) as { newPhone?: unknown; expectedVersion?: unknown; reason?: unknown } | null;
    const newPhone = typeof body?.newPhone === "string" ? body.newPhone.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const expectedVersion = body?.expectedVersion;
    if (!newPhone) return NextResponse.json({ error: "Vui lòng nhập số điện thoại mới." }, { status: 400 });
    if (reason.length < 3) return NextResponse.json({ error: "Vui lòng ghi lý do đổi số (ít nhất 3 ký tự)." }, { status: 400 });
    if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return NextResponse.json({ error: "Thiếu phiên bản hồ sơ, vui lòng tải lại." }, { status: 400 });
    }

    const res = await cdpCore.post<{ customer: CoreCustomer }>(`/internal/v1/customers/${encodeURIComponent(customerId)}/phone`, {
      staff,
      idempotencyKey: intentKey(req, "customer-phone-change"),
      body: { newPhone, expectedVersion, reason: reason.slice(0, 300) },
    });
    return NextResponse.json({ success: true, member: toLegacyMemberResponse(res.data!.customer) });
  } catch (error) {
    return coreErrorResponse(error);
  }
}
