import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, cdpCore, coreErrorResponse } from "@/lib/cores";
import { toLegacyCdpTiers, type CoreCatalog, type CoreLoyaltyRules } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [catalog, rules] = await Promise.all([
      bookingCore.get<CoreCatalog>("/internal/v1/catalog", { staff }),
      cdpCore.get<CoreLoyaltyRules>("/internal/v1/loyalty/rules", { staff }).catch(() => null),
    ]);
    const c = catalog.data!;

    return NextResponse.json(
      {
        bookingRules: c.bookingRules,
        hourlySlots: c.hourlyCheckinSlots.slots,
        cdpTiers: rules?.data ? toLegacyCdpTiers(rules.data) : {},
        loyaltyRules: rules?.data ?? null,
        inventoryPolicy: c.inventoryPolicy,
        catalogVersion: c.catalogVersion,
      },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch (error) {
    console.error("Get configs error:", error);
    return coreErrorResponse(error);
  }
}

