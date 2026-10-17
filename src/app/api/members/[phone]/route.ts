import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { cdpCore, coreErrorResponse } from "@/lib/cores";
import { toLegacyMemberResponse, type CoreCustomer } from "@/lib/coreMappers";

/** Member = CDP customer. Lookup by phone; profile edits use optimistic `expectedVersion`. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { phone } = await params;
    if (!phone) return NextResponse.json({ error: "Missing phone parameter" }, { status: 400 });

    const res = await cdpCore.post<{ found: boolean; customer: CoreCustomer | null }>("/internal/v1/customers/lookup", {
      staff,
      body: { phone },
    });
    if (!res.data?.found || !res.data.customer) return NextResponse.json({ found: false, member: null });
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

