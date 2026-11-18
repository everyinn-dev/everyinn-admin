import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { cdpCore, coreErrorResponse } from "@/lib/cores";
import { toLegacyMemberResponse, type CoreCustomer } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";

interface RetiredPhone {
  customerId: string;
  changedAt: string;
  currentPhoneMasked: string | null;
  currentPhoneNational: string | null;
  fullName: string | null;
}

/** Member = CDP customer. Lookup by phone; profile edits use optimistic `expectedVersion`. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { phone } = await params;
    if (!phone) return NextResponse.json({ error: "Missing phone parameter" }, { status: 400 });

    const res = await cdpCore.post<{ found: boolean; customer: CoreCustomer | null; retiredPhone?: RetiredPhone }>("/internal/v1/customers/lookup", {
      staff,
      body: { phone },
    });
    if (!res.data?.found || !res.data.customer) {
      // Number retired by a phone change → let staff jump to the profile that now owns its history.
      return NextResponse.json({ found: false, member: null, ...(res.data?.retiredPhone ? { retiredPhone: res.data.retiredPhone } : {}) });
    }
    return NextResponse.json({ found: true, member: toLegacyMemberResponse(res.data.customer) });
  } catch (error) {
    console.error("CDP member lookup error:", error);
    return coreErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { phone } = await params;
    if (!phone) return NextResponse.json({ error: "Missing phone parameter" }, { status: 400 });

    const body = (await req.json()) as { instagram?: string; facebook?: string; zalo?: string; fullName?: string; internalNotes?: string };

    const lookup = await cdpCore.post<{ found: boolean; customer: CoreCustomer | null }>("/internal/v1/customers/lookup", { staff, body: { phone } });
    const current = lookup.data?.customer;
    if (!lookup.data?.found || !current) return NextResponse.json({ error: "Không tìm thấy thành viên" }, { status: 404 });

    const patch: Record<string, unknown> = { expectedVersion: current.version };
    for (const k of ["instagram", "facebook", "zalo", "fullName", "internalNotes"] as const) {
      if (typeof body[k] === "string") patch[k] = body[k];
    }
    const res = await cdpCore.patch<{ customer: CoreCustomer }>(`/internal/v1/customers/${encodeURIComponent(current.customerId)}`, { staff, body: patch });

    return NextResponse.json({
      success: true,
      message: "Cập nhật tài khoản mạng xã hội thành công",
      member: toLegacyMemberResponse(res.data!.customer),
    });
  } catch (error) {
    console.error("Update member error:", error);
    return coreErrorResponse(error);
  }
}

