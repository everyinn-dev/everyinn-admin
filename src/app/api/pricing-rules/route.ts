import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PricingRule } from "@/types";

export async function GET() {
  try {
    const db = await getDb();
    const { results } = await db
      .prepare(
        `SELECT id, property_id, room_class, booking_type, base_price, extra_hour_fee, is_active
         FROM pricing_rules
         WHERE is_active = 1`
      )
      .all<PricingRule>();

    return NextResponse.json({ pricingRules: results });
  } catch (error) {
    console.error("Get pricing rules error:", error);
    return NextResponse.json({ error: "Failed to load pricing rules" }, { status: 500 });
  }
}
