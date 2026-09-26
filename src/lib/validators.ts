export interface BookingSlot {
  checkinAt: string; // ISO string
  checkoutAt: string; // ISO string
  roomId: string;
  excludeBookingId?: string; // Exclude current booking when editing or extending
}

export type ConflictType = "direct" | "buffer_prior" | "buffer_next" | "room_block";

export interface ConflictingBooking {
  id: string | number;
  checkin_at: string;
  checkout_at: string;
  member_name?: string;
  conflictType: ConflictType;
}

export interface OverlapCheckResult {
  hasOverlap: boolean;
  conflict?: ConflictingBooking;
  errorMessage?: string;
}

function formatDateTimeVi(isoString: string): string {
  try {
    const d = new Date(isoString);
    const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    return `${time} (${date})`;
  } catch {
    return isoString;
  }
}

/**
 * Check if a booking slot collides with existing non-cancelled bookings or room maintenance blocks,
 * ENFORCING a strict 60-minute turnover/cleaning buffer immediately after every booking checkout.
 *
 * Rules:
 * 1. No direct overlap with another booking.
 * 2. New booking cannot start within 60 minutes after a previous booking's checkout.
 * 3. New booking cannot end within 60 minutes before a subsequent booking's checkin.
 * 4. Cannot overlap with any maintenance room blocks.
 */
export async function checkBookingOverlapWithBuffer(
  db: D1Database,
  slot: BookingSlot,
  roomName?: string
): Promise<OverlapCheckResult> {
  const { roomId, checkinAt, checkoutAt, excludeBookingId } = slot;
  const roomNameDisplay = roomName ? `${roomName}` : `${roomId}`;

  const checkinDate = new Date(checkinAt);
  const checkoutDate = new Date(checkoutAt);
  const checkinMs = checkinDate.getTime();
  const checkoutMs = checkoutDate.getTime();

  if (isNaN(checkinMs) || isNaN(checkoutMs) || checkoutMs <= checkinMs) {
    return {
      hasOverlap: true,
      errorMessage: "Thời gian nhận phòng và trả phòng không hợp lệ.",
    };
  }

  // 1. Check room maintenance blocks (exact interval check)
  const roomBlock = await db
    .prepare(
      `SELECT id, blocked_from, blocked_to, reason
       FROM room_blocks
       WHERE room_id = ?
         AND blocked_from < ?
         AND blocked_to > ?
       LIMIT 1`
    )
    .bind(roomId, checkoutAt, checkinAt)
    .first<{ id: number; blocked_from: string; blocked_to: string; reason?: string }>();

  if (roomBlock) {
    return {
      hasOverlap: true,
      conflict: {
        id: roomBlock.id,
        checkin_at: roomBlock.blocked_from,
        checkout_at: roomBlock.blocked_to,
        conflictType: "room_block",
      },
      errorMessage: `Phòng ${roomNameDisplay} đang bị khóa bảo trì (#${roomBlock.id}) từ ${formatDateTimeVi(
        roomBlock.blocked_from
      )} đến ${formatDateTimeVi(roomBlock.blocked_to)}${
        roomBlock.reason ? ` (${roomBlock.reason})` : ""
      }.`,
    };
  }

  // 2. Turnover buffer interval math (60 minutes = 3,600,000 ms):
  // Every booking effectively reserves [checkin, checkout + 60min).
  // Two bookings A and B overlap iff:
  // A.checkin < B.checkout + 60min AND A.checkout + 60min > B.checkin
  // <=> A.checkin < (newCheckout + 60min) AND A.checkout > (newCheckin - 60min)
  const bufferMs = 60 * 60 * 1000;
  const newCheckinMinusBufferIso = new Date(checkinMs - bufferMs).toISOString();
  const newCheckoutPlusBufferIso = new Date(checkoutMs + bufferMs).toISOString();

  const conflict = await db
    .prepare(
      `SELECT id, checkin_at, checkout_at, member_name
       FROM bookings
       WHERE room_id = ?
         AND status != 'cancelled'
         AND id != ?
         AND checkin_at < ?
         AND checkout_at > ?
       ORDER BY checkin_at ASC
       LIMIT 1`
    )
    .bind(roomId, excludeBookingId || "", newCheckoutPlusBufferIso, newCheckinMinusBufferIso)
    .first<{ id: string; checkin_at: string; checkout_at: string; member_name?: string }>();

  if (!conflict) {
    return { hasOverlap: false };
  }

  const existingCheckinMs = new Date(conflict.checkin_at).getTime();
  const existingCheckoutMs = new Date(conflict.checkout_at).getTime();

  // Distinguish the specific reason for clear receptionist feedback
  if (existingCheckinMs < checkoutMs && existingCheckoutMs > checkinMs) {
    // Direct overlap
    return {
      hasOverlap: true,
      conflict: {
        id: conflict.id,
        checkin_at: conflict.checkin_at,
        checkout_at: conflict.checkout_at,
        member_name: conflict.member_name,
        conflictType: "direct",
      },
      errorMessage: `Phòng ${roomNameDisplay} đã có lịch đặt (#${conflict.id}) từ ${formatDateTimeVi(
        conflict.checkin_at
      )} đến ${formatDateTimeVi(conflict.checkout_at)}.`,
    };
  } else if (existingCheckoutMs <= checkinMs) {
    // Previous booking cleaning buffer conflict
    const cleanUntilIso = new Date(existingCheckoutMs + bufferMs).toISOString();
    return {
      hasOverlap: true,
      conflict: {
        id: conflict.id,
        checkin_at: conflict.checkin_at,
        checkout_at: conflict.checkout_at,
        member_name: conflict.member_name,
        conflictType: "buffer_prior",
      },
      errorMessage: `Phòng ${roomNameDisplay} vừa có khách trả phòng lúc ${formatDateTimeVi(
        conflict.checkout_at
      )} (#${conflict.id}). Cần 1 giờ dọn phòng (đến ${formatDateTimeVi(
        cleanUntilIso
      )}), vui lòng chọn giờ nhận phòng từ ${formatDateTimeVi(cleanUntilIso)} trở đi.`,
    };
  } else {
    // Next booking cleaning buffer conflict
    const cleanBeforeIso = new Date(existingCheckinMs - bufferMs).toISOString();
    return {
      hasOverlap: true,
      conflict: {
        id: conflict.id,
        checkin_at: conflict.checkin_at,
        checkout_at: conflict.checkout_at,
        member_name: conflict.member_name,
        conflictType: "buffer_next",
      },
      errorMessage: `Phòng ${roomNameDisplay} có khách đặt tiếp theo (#${conflict.id}) lúc ${formatDateTimeVi(
        conflict.checkin_at
      )}. Cần 1 giờ dọn phòng trước đó, vui lòng chọn giờ trả phòng trước hoặc vào lúc ${formatDateTimeVi(
        cleanBeforeIso
      )}.`,
    };
  }
}

/**
 * Standard overlap check without cleaning buffer (for backward compatibility if needed)
 */
export async function checkBookingOverlap(
  db: D1Database,
  slot: BookingSlot,
  roomName?: string
): Promise<OverlapCheckResult> {
  const { roomId, checkinAt, checkoutAt, excludeBookingId } = slot;
  const roomNameDisplay = roomName ? `${roomName}` : `${roomId}`;

  const overlap = await db
    .prepare(
      `SELECT id, checkin_at, checkout_at, member_name
       FROM bookings
       WHERE room_id = ?
         AND status != 'cancelled'
         AND id != ?
         AND checkin_at < ?
         AND checkout_at > ?
       LIMIT 1`
    )
    .bind(roomId, excludeBookingId || "", checkoutAt, checkinAt)
    .first<{ id: string; checkin_at: string; checkout_at: string; member_name?: string }>();

  if (overlap) {
    return {
      hasOverlap: true,
      conflict: {
        id: overlap.id,
        checkin_at: overlap.checkin_at,
        checkout_at: overlap.checkout_at,
        member_name: overlap.member_name,
        conflictType: "direct",
      },
      errorMessage: `Phòng ${roomNameDisplay} đã có lịch đặt (#${overlap.id}) từ ${formatDateTimeVi(
        overlap.checkin_at
      )} đến ${formatDateTimeVi(overlap.checkout_at)}.`,
    };
  }

  return { hasOverlap: false };
}
