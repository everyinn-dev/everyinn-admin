import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import { toLegacyPricingRule, type CoreCatalog } from "@/lib/coreMappers";
import type { PricingRule } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await bookingCore.get<CoreCatalog>("/internal/v1/catalog", { staff });
    const catalog = data!;
    const propertyId = catalog.property?.id ?? "every-inn";
    const rawRules = catalog.rateRules || catalog.pricingRules || [];
    const pricingRules = rawRules
      .filter((r) => r.isActive)
      .map((r, i) => toLegacyPricingRule(r, propertyId, i))
      .filter((r): r is PricingRule => r !== null);

    return NextResponse.json({ pricingRules }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    console.error("Get pricing rules error:", error);
    return coreErrorResponse(error);
  }
}

