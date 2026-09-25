import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCachedRooms } from "@/lib/masterData";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const rooms = await getCachedRooms(db);

    return NextResponse.json(
      { rooms },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=3600",
        },
      }
    );
  } catch (error) {
    console.error("Get rooms error:", error);
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 });
  }
}
