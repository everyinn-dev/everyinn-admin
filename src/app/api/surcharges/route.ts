import { getCurrentStaff } from "@/lib/auth";
import { bookingCore } from "@/lib/cores";
import { toHttpError } from "@/lib/apiError";
import {
  toLegacySurchargeRule,
  type CoreSurchargeRuleDto,
  type CoreSurchargeRuleEnvelope,
} from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coreRes = await bookingCore.get<{ surchargeRules: CoreSurchargeRuleDto[] }>(
      "/internal/v1/surcharge-rules",
      { staff }
    );

    const surchargeRules = (coreRes.data?.surchargeRules || []).map(toLegacySurchargeRule);
    return Response.json({ surchargeRules });
  } catch (error: any) {
    return toHttpError(error);
  }
}

export async function POST(req: Request) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const coreBody = {
      code: String(body.code || "").trim().toUpperCase(),
      name: String(body.name || "").trim(),
      surchargeType: body.surcharge_type || body.surchargeType || "holiday",
      calcMode: body.calc_mode || body.calcMode || "percentage",
      amount: Number(body.amount ?? 0),
      unitScope: body.unit_scope || body.unitScope || "per_night",
      guestThreshold: Number(body.guest_threshold ?? body.guestThreshold ?? 2),
      startDate: body.start_date || body.startDate || null,
      endDate: body.end_date || body.endDate || null,
      applicableDaysOfWeek: body.applicable_days_of_week || body.applicableDaysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      applicableRoomClasses: body.applicable_room_classes || body.applicableRoomClasses || ["haven", "signature"],
      applicableBookingTypes: body.applicable_booking_types || body.applicableBookingTypes || ["hourly", "overnight", "dayuse", "custom"],
      priority: Number(body.priority ?? 10),
      isActive: body.is_active !== undefined ? Boolean(body.is_active) : Boolean(body.isActive ?? true),
    };

    const coreRes = await bookingCore.post<CoreSurchargeRuleEnvelope>(
      "/internal/v1/surcharge-rules",
      {
        staff,
        body: coreBody,
      }
    );

    if (!coreRes.data?.surchargeRule) {
      throw new Error("Không nhận được dữ liệu quy tắc phụ thu từ Booking Core.");
    }

    return Response.json(
      { success: true, surchargeRule: toLegacySurchargeRule(coreRes.data.surchargeRule) },
      { status: 201 }
    );
  } catch (error: any) {
    return toHttpError(error);
  }
}
