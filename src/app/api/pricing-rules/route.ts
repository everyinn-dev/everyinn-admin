import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCachedPricingRules } from "@/lib/masterData";

export async function GET() {
  try {
    const db = await getDb();
    const pricingRules = await getCachedPricingRules(db);

    return NextResponse.json({ pricingRules });
  } catch (error) {
    console.error("Get pricing rules error:", error);
    return NextResponse.json({ error: "Failed to load pricing rules" }, { status: 500 });
  }
}
