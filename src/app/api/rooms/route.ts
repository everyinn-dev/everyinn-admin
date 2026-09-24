import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { Room } from "@/types";

export async function GET() {
  try {
    const db = await getDb();
    const { results } = await db
      .prepare(
        `SELECT id, property_id, room_number, name, room_class, floor, area_sqm, max_guests, sort_order, is_active
         FROM rooms
         WHERE is_active = 1
         ORDER BY sort_order ASC, room_number ASC`
      )
      .all<Room>();

    return NextResponse.json({ rooms: results });
  } catch (error) {
    console.error("Get rooms error:", error);
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 });
  }
}
