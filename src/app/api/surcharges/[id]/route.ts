import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import {
  toLegacySurchargeRule,
  type CoreSurchargeRuleEnvelope,
} from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const coreBody: Record<string, unknown> = {
      expectedVersion: Number(body.expectedVersion ?? body.version ?? 1),
    };

    if (body.code !== undefined) coreBody.code = String(body.code).trim().toUpperCase();
    if (body.name !== undefined) coreBody.name = String(body.name).trim();
    if (body.surcharge_type !== undefined || body.surchargeType !== undefined) {
      coreBody.surchargeType = body.surcharge_type || body.surchargeType;
    }
    if (body.calc_mode !== undefined || body.calcMode !== undefined) {
      coreBody.calcMode = body.calc_mode || body.calcMode;
    }
    if (body.amount !== undefined) coreBody.amount = Number(body.amount);
    if (body.unit_scope !== undefined || body.unitScope !== undefined) {
      coreBody.unitScope = body.unit_scope || body.unitScope;
    }
    if (body.guest_threshold !== undefined || body.guestThreshold !== undefined) {
      coreBody.guestThreshold = Number(body.guest_threshold ?? body.guestThreshold);
    }
    if (body.start_date !== undefined || body.startDate !== undefined) {
      coreBody.startDate = body.start_date || body.startDate || null;
    }
    if (body.end_date !== undefined || body.endDate !== undefined) {
      coreBody.endDate = body.end_date || body.endDate || null;
    }
    if (body.applicable_days_of_week || body.applicableDaysOfWeek) {
      coreBody.applicableDaysOfWeek = body.applicable_days_of_week || body.applicableDaysOfWeek;
    }
    if (body.applicable_room_classes || body.applicableRoomClasses) {
      coreBody.applicableRoomClasses = body.applicable_room_classes || body.applicableRoomClasses;
    }
    if (body.applicable_booking_types || body.applicableBookingTypes) {
      coreBody.applicableBookingTypes = body.applicable_booking_types || body.applicableBookingTypes;
    }
    if (body.priority !== undefined) coreBody.priority = Number(body.priority);
    if (body.is_active !== undefined || body.isActive !== undefined) {
      coreBody.isActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(body.isActive);
    }

    const coreRes = await bookingCore.patch<CoreSurchargeRuleEnvelope>(
      `/internal/v1/surcharge-rules/${id}`,
      {
        staff,
        body: coreBody,
      }
    );

    if (!coreRes.data?.surchargeRule) {
      throw new Error("Không nhận được dữ liệu quy tắc phụ thu từ Booking Core.");
    }

    return Response.json({
      success: true,
      surchargeRule: toLegacySurchargeRule(coreRes.data.surchargeRule),
    });
  } catch (error: any) {
    return toHttpError(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await bookingCore.post<CoreSurchargeRuleEnvelope>(
      `/internal/v1/surcharge-rules/${id}/archive`,
      {
        staff,
        body: {},
      }
    );

    return Response.json({
      success: true,
      message: "Đã lưu trữ (xóa) quy tắc phụ thu thành công.",
    });
  } catch (error: any) {
    return toHttpError(error);
  }
}
