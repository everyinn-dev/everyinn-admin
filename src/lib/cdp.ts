import { LoyaltyTier, Member, BookingType, RoomClass } from "@/types";
import { logEvent } from "./audit";

export function calculateLoyaltyTier(totalSpent: number, totalBookings: number): LoyaltyTier {
  if (totalBookings >= 10 || totalSpent >= 8000000) return 'gold';
  if (totalBookings >= 5 || totalSpent >= 3000000) return 'silver';
  if (totalBookings >= 1 || totalSpent >= 500000) return 'bronze';
  return 'new';
}

export async function lookupMember(db: D1Database, phone: string): Promise<Member | null> {
  const cleanPhone = phone.trim();
  if (!cleanPhone) return null;

  const result = await db
    .prepare("SELECT * FROM members WHERE phone = ? LIMIT 1")
    .bind(cleanPhone)
    .first<Member>();

  return result || null;
}

export async function upsertMemberOnBooking(
  db: D1Database,
  data: {
    phone: string;
    name: string;
    totalPrice: number;
    bookingType: BookingType;
    roomClass: RoomClass;
    staffId?: number;
  }
): Promise<{
  member: Member;
  isNew: boolean;
  tierChanged: boolean;
  oldTier?: LoyaltyTier;
}> {
  const cleanPhone = data.phone.trim();
  const existing = await lookupMember(db, cleanPhone);
  const now = new Date().toISOString();

  const isNightStay = data.bookingType === 'overnight' || data.bookingType === 'dayuse';
  const nightsToAdd = isNightStay ? 1 : 0;

  if (!existing) {
    const newTier = calculateLoyaltyTier(data.totalPrice, 1);
    await db
      .prepare(
        `INSERT INTO members (
          phone, full_name, total_bookings, total_spent, total_nights,
          first_booked_at, last_booked_at, loyalty_tier, preferred_room_class
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        cleanPhone,
        data.name,
        data.totalPrice,
        nightsToAdd,
        now,
        now,
        newTier,
        data.roomClass
      )
      .run();

    await logEvent(
      db,
      'MEMBER_CREATED',
      'member',
      cleanPhone,
      { phone: cleanPhone, name: data.name, tier: newTier },
      data.staffId
    );

    const createdMember: Member = {
      phone: cleanPhone,
      full_name: data.name,
      total_bookings: 1,
      total_spent: data.totalPrice,
      total_nights: nightsToAdd,
      first_booked_at: now,
      last_booked_at: now,
      loyalty_tier: newTier,
      preferred_room_class: data.roomClass,
      is_blocked: 0,
      portal_opt_in: 0,
      created_at: now,
      updated_at: now,
    };

    return { member: createdMember, isNew: true, tierChanged: false };
  } else {
    const updatedSpent = existing.total_spent + data.totalPrice;
    const updatedBookings = existing.total_bookings + 1;
    const updatedNights = existing.total_nights + nightsToAdd;
    const newTier = calculateLoyaltyTier(updatedSpent, updatedBookings);
    const tierChanged = newTier !== existing.loyalty_tier;

    await db
      .prepare(
        `UPDATE members SET
          full_name = COALESCE(?, full_name),
          total_bookings = ?,
          total_spent = ?,
          total_nights = ?,
          last_booked_at = ?,
          loyalty_tier = ?,
          preferred_room_class = ?,
          updated_at = ?
         WHERE phone = ?`
      )
      .bind(
        data.name || existing.full_name,
        updatedBookings,
        updatedSpent,
        updatedNights,
        now,
        newTier,
        data.roomClass,
        now,
        cleanPhone
      )
      .run();

    if (tierChanged) {
      await logEvent(
        db,
        'MEMBER_TIER_CHANGED',
        'member',
        cleanPhone,
        {
          phone: cleanPhone,
          oldTier: existing.loyalty_tier,
          newTier,
          totalSpent: updatedSpent,
          totalBookings: updatedBookings,
        },
        data.staffId
      );
    }

    const updatedMember: Member = {
      ...existing,
      full_name: data.name || existing.full_name,
      total_bookings: updatedBookings,
      total_spent: updatedSpent,
      total_nights: updatedNights,
      last_booked_at: now,
      loyalty_tier: newTier,
      preferred_room_class: data.roomClass,
      updated_at: now,
    };

    return {
      member: updatedMember,
      isNew: false,
      tierChanged,
      oldTier: existing.loyalty_tier,
    };
  }
}
