import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const currentStaff = await getCurrentStaff(db);

    if (!currentStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { results } = await db
      .prepare(
        "SELECT id, full_name, role FROM staff WHERE is_active = 1 ORDER BY full_name ASC"
      )
      .all();

    return NextResponse.json(
      { staff: results || [] },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("GET staff error:", error);
    return NextResponse.json({ error: "Failed to load staff list" }, { status: 500 });
  }
}
