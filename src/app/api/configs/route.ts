import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCachedBookingRules, getCachedHourlySlots, getCachedCdpTiers } from "@/lib/masterData";

export async function GET() {
  try {
    const db = await getDb();
    const [bookingRules, hourlySlots, cdpTiers] = await Promise.all([
      getCachedBookingRules(db),
      getCachedHourlySlots(db),
      getCachedCdpTiers(db),
    ]);

    return NextResponse.json({
      bookingRules,
      hourlySlots,
      cdpTiers,
    });
  } catch (error) {
    console.error("Get configs error:", error);
    return NextResponse.json({ error: "Failed to load configs" }, { status: 500 });
  }
}
