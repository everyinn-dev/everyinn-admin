import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCachedRooms } from "@/lib/masterData";

export async function GET() {
  try {
    const db = await getDb();
    const rooms = await getCachedRooms(db);

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("Get rooms error:", error);
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 });
  }
}
