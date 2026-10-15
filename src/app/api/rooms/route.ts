import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import { toLegacyRoom, type CoreCatalog } from "@/lib/coreMappers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = await getCurrentStaff(await getDb());
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await bookingCore.get<CoreCatalog>("/internal/v1/catalog", { staff });
    const catalog = data!;
    const propertyId = catalog.property?.id ?? "every-inn";
    const rooms = catalog.rooms.filter((r) => r.isActive).map((r) => toLegacyRoom(r, propertyId));

    return NextResponse.json({ rooms }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    console.error("Get rooms error:", error);
    return coreErrorResponse(error);
  }
}

