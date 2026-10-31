import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import type { CoreHoldEnvelope } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/holds/[id] — Get current hold state & remaining countdown seconds.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const holdId = String(id ?? "").trim();
    if (!holdId) {
      return NextResponse.json({ error: "Thiếu mã phiên giữ phòng." }, { status: 400 });
    }

    const res = await bookingCore.get<CoreHoldEnvelope>(`/internal/v1/holds/${encodeURIComponent(holdId)}`, {
      staff,
    });

    return NextResponse.json({ hold: res.data!.hold }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/holds/[id] error:", error);
    return coreErrorResponse(error);
  }
}

/**
 * PATCH /api/holds/[id] — Save Step 2 guest/payment draft and move hold to awaiting_payment (without resetting 15m timer).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const holdId = String(id ?? "").trim();
    if (!holdId) {
      return NextResponse.json({ error: "Thiếu mã phiên giữ phòng." }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const phone = String(body.phone ?? "").trim();
    const name = String(body.name ?? "").trim();
    const instagram = String(body.instagram ?? "").trim();
    const facebook = String(body.facebook ?? "").trim();
    const zalo = String(body.zalo ?? "").trim();
    const closingNote = String(body.closingNote ?? body.closing_note ?? "").trim();
    const note = String(body.note ?? "").trim() || undefined;
    const promotionId = String(body.promotionId ?? body.promotion_id ?? "").trim() || undefined;
    const promotionCode = String(body.promotionCode ?? body.promotion_code ?? "").trim().toUpperCase() || undefined;
    const isDeposit = Boolean(body.isDeposit ?? body.is_deposit);
    const depositAmount = Math.round(Number(body.depositAmount ?? body.deposit_amount) || 0);
    const depositDueDate = String(body.depositDueDate ?? body.deposit_due_date ?? "").trim() || undefined;
    const paymentMethod = String(body.paymentMethod ?? "bank_transfer").trim() || "bank_transfer";

    if (!phone || !name) {
      return NextResponse.json({ error: "Vui lòng nhập đầy đủ số điện thoại và họ tên khách hàng." }, { status: 400 });
    }
    if (!instagram && !facebook && !zalo) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên tài khoản Facebook, Instagram hoặc Zalo (bắt buộc phải có ít nhất 1 trong 3)." },
        { status: 400 }
      );
    }
    if (closingNote.length < 3) {
      return NextResponse.json(
        { error: "Vui lòng nhập 'Câu chốt với khách' (bắt buộc tối thiểu 3 ký tự)." },
        { status: 400 }
      );
    }
    if (isDeposit && depositAmount <= 0) {
      return NextResponse.json({ error: "Vui lòng nhập số tiền đặt cọc lớn hơn 0." }, { status: 400 });
    }

    const res = await bookingCore.patch<CoreHoldEnvelope>(`/internal/v1/holds/${encodeURIComponent(holdId)}`, {
      staff,
      body: {
        guest: {
          name,
          phone,
          instagram: instagram || undefined,
          facebook: facebook || undefined,
          zalo: zalo || undefined,
        },
        closingNote,
        note,
        promotionId,
        promotionCode,
        isDeposit,
        depositAmount: isDeposit ? depositAmount : 0,
        depositDueDate: isDeposit ? depositDueDate : undefined,
        paymentMethod,
      },
    });

    return NextResponse.json(
      {
        success: true,
        hold: res.data!.hold,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("PATCH /api/holds/[id] error:", error);
    return coreErrorResponse(error);
  }
}

/**
 * DELETE /api/holds/[id] — Release/cancel the 15-minute hold immediately ("Thoát & Chọn lại").
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const holdId = String(id ?? "").trim();
    if (!holdId) {
      return NextResponse.json({ error: "Thiếu mã phiên giữ phòng." }, { status: 400 });
    }

    let reason = "Lễ tân bấm Thoát & Chọn lại phòng";
    try {
      const body = (await req.json()) as Record<string, unknown>;
      if (body?.reason) reason = String(body.reason).trim();
    } catch {
      // Optional body on DELETE
    }

    const res = await bookingCore.post<CoreHoldEnvelope>(
      `/internal/v1/holds/${encodeURIComponent(holdId)}/release`,
      {
        staff,
        body: { reason },
      }
    );

    return NextResponse.json(
      {
        success: true,
        hold: res.data!.hold,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("DELETE /api/holds/[id] error:", error);
    return coreErrorResponse(error);
  }
}

