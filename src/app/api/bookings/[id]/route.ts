import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { getLogEventStatement } from "@/lib/audit";
import { invalidatePrefix } from "@/lib/cache";
import { getCachedRooms, getCachedPricingRules, getCachedCdpTiers } from "@/lib/masterData";
import { checkBookingOverlapWithBuffer } from "@/lib/validators";
import { calculatePrice } from "@/lib/pricing";
import { lookupMember, calculateLoyaltyTier } from "@/lib/cdp";
import { Booking, BookingType } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await db
      .prepare(
        `SELECT b.*, r.name as room_name, r.room_class, s.full_name as created_by_staff_name
         FROM bookings b
         LEFT JOIN rooms r ON b.room_id = r.id
         LEFT JOIN staff s ON b.created_by_staff_id = s.id
         WHERE b.id = ?
         LIMIT 1`
      )
      .bind(id)
      .first<Booking>();

    if (!booking) {
      return NextResponse.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    }

    return NextResponse.json({ booking });
  } catch (error) {
    console.error("GET booking by ID error:", error);
    return NextResponse.json({ error: "Lỗi tải thông tin đặt phòng." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json()) as any;
    const { action } = body;

    const existing = await db
      .prepare("SELECT * FROM bookings WHERE id = ? LIMIT 1")
      .bind(id)
      .first<Booking>();

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    }

    const rooms = await getCachedRooms(db);
    const now = new Date().toISOString();

    // ── ACTION: CANCEL ───────────────────────────────────────────
    if (action === "cancel") {
      const cancelReason = body.cancelReason || "Lễ tân hủy";

      const updateStmt = db
        .prepare(
          `UPDATE bookings SET
            status = 'cancelled',
            cancelled_at = ?,
            cancel_reason = ?,
            cancelled_by = ?,
            updated_at = ?
           WHERE id = ?`
        )
        .bind(now, cancelReason, staff.id, now, id);

      const logStmt = getLogEventStatement(
        db,
        "BOOKING_CANCELLED",
        "booking",
        id,
        { cancelReason, cancelledByStaffId: staff.id },
        staff.id
      );

      await db.batch([updateStmt, logStmt]);
      invalidatePrefix("dashboard:gantt:");

      return NextResponse.json({ success: true, message: "Đã hủy đặt phòng thành công." });
    }

    // ── ACTION: EXTEND 1 HOUR ─────────────────────────────────────
    if (action === "extend1h") {
      if (existing.status === "cancelled") {
        return NextResponse.json({ error: "Không thể gia hạn đơn đặt phòng đã bị hủy." }, { status: 400 });
      }

      const currentCheckoutDate = new Date(existing.checkout_at);
      if (isNaN(currentCheckoutDate.getTime())) {
        return NextResponse.json({ error: "Thời gian trả phòng hiện tại không hợp lệ." }, { status: 400 });
      }

      // Add exactly 60 minutes
      const newCheckoutDate = new Date(currentCheckoutDate.getTime() + 60 * 60 * 1000);
      const newCheckoutIso = newCheckoutDate.toISOString();

      const currentRoom = rooms.find((r) => r.id === existing.room_id);

      // Validate overlap + 1h buffer collision (excluding self)
      const overlapResult = await checkBookingOverlapWithBuffer(
        db,
        {
          roomId: existing.room_id,
          checkinAt: existing.checkin_at,
          checkoutAt: newCheckoutIso,
          excludeBookingId: existing.id,
        },
        currentRoom?.name
      );

      if (overlapResult.hasOverlap) {
        return NextResponse.json(
          {
            error:
              overlapResult.errorMessage ||
              "Không thể gia hạn thêm 1h vì xung đột lịch đặt tiếp theo hoặc không đủ 1h dọn phòng.",
          },
          { status: 409 }
        );
      }

      const extraFeeDelta = 60000;
      const newExtraFee = (existing.extra_fee || 0) + extraFeeDelta;
      const newTotalPrice = (existing.total_price || 0) + extraFeeDelta;
      const newLateHours = (existing.late_checkout_hours || 0) + 1;

      const updateStmt = db
        .prepare(
          `UPDATE bookings SET
            checkout_at = ?,
            extra_fee = ?,
            total_price = ?,
            late_checkout_hours = ?,
            updated_at = ?
           WHERE id = ?`
        )
        .bind(newCheckoutIso, newExtraFee, newTotalPrice, newLateHours, now, id);

      const logStmt = getLogEventStatement(
        db,
        "BOOKING_EXTENDED_1H",
        "booking",
        id,
        {
          previousCheckoutAt: existing.checkout_at,
          newCheckoutAt: newCheckoutIso,
          previousTotalPrice: existing.total_price,
          newTotalPrice,
          staffId: staff.id,
        },
        staff.id
      );

      await db.batch([updateStmt, logStmt]);

      // Adjust member total spend if registered member
      if (existing.member_phone) {
        const member = await lookupMember(db, existing.member_phone);
        if (member) {
          const updatedSpent = Math.max(0, (member.total_spent || 0) + extraFeeDelta);
          const tiers = await getCachedCdpTiers(db);
          const newTier = calculateLoyaltyTier(updatedSpent, member.total_bookings, tiers);
          await db
            .prepare(
              `UPDATE members SET total_spent = ?, loyalty_tier = ?, updated_at = ? WHERE phone = ?`
            )
            .bind(updatedSpent, newTier, now, existing.member_phone)
            .run();
        }
      }

      invalidatePrefix("dashboard:gantt:");

      return NextResponse.json({
        success: true,
        message: "Đã gia hạn thêm 1 giờ trả phòng (+60.000đ).",
        booking: {
          ...existing,
          checkout_at: newCheckoutIso,
          extra_fee: newExtraFee,
          total_price: newTotalPrice,
          late_checkout_hours: newLateHours,
        },
      });
    }

    // ── ACTION: UPDATE BOOKING ────────────────────────────────────
    if (action === "update") {
      if (existing.status === "cancelled") {
        return NextResponse.json({ error: "Không thể chỉnh sửa đơn đặt phòng đã bị hủy." }, { status: 400 });
      }

      const {
        roomId,
        bookingType,
        checkinAt,
        checkoutAt,
        lateCheckoutHours = 0,
        customPrice = 0,
        note,
        closingNote,
      } = body;

      const targetRoomId = roomId || existing.room_id;
      const targetRoom = rooms.find((r) => r.id === targetRoomId);
      if (!targetRoom) {
        return NextResponse.json({ error: "Phòng được chọn không tồn tại." }, { status: 404 });
      }

      const targetBookingType = (bookingType || existing.booking_type) as BookingType;
      const targetCheckin = checkinAt || existing.checkin_at;
      const targetCheckout = checkoutAt || existing.checkout_at;
      const targetLateHours = Number(lateCheckoutHours) || 0;

      const checkinDate = new Date(targetCheckin);
      const checkoutDate = new Date(targetCheckout);

      if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime()) || checkoutDate <= checkinDate) {
        return NextResponse.json({ error: "Thời gian nhận phòng hoặc trả phòng không hợp lệ." }, { status: 400 });
      }

      // Check overlap + 1h buffer collision (excluding this booking)
      const overlapResult = await checkBookingOverlapWithBuffer(
        db,
        {
          roomId: targetRoomId,
          checkinAt: checkinDate.toISOString(),
          checkoutAt: checkoutDate.toISOString(),
          excludeBookingId: existing.id,
        },
        targetRoom.name
      );

      if (overlapResult.hasOverlap) {
        return NextResponse.json(
          {
            error:
              overlapResult.errorMessage ||
              "Khung giờ phòng đã bị trùng lặp hoặc không đủ 1 giờ dọn phòng.",
          },
          { status: 409 }
        );
      }

      // Recalculate price snapshot
      const pricingRules = await getCachedPricingRules(db);
      const pricing = calculatePrice({
        bookingType: targetBookingType,
        roomClass: targetRoom.room_class,
        checkinAt: checkinDate,
        checkoutAt: checkoutDate,
        lateCheckoutHours: targetLateHours,
        pricingRules,
        customPrice: Number(customPrice) || 0,
      });

      const priceDelta = pricing.totalPrice - (existing.total_price || 0);

      const updateStmt = db
        .prepare(
          `UPDATE bookings SET
            room_id = ?,
            booking_type = ?,
            checkin_at = ?,
            checkout_at = ?,
            late_checkout_hours = ?,
            base_price = ?,
            extra_fee = ?,
            total_price = ?,
            note = ?,
            closing_note = ?,
            updated_at = ?
           WHERE id = ?`
        )
        .bind(
          targetRoomId,
          targetBookingType,
          checkinDate.toISOString(),
          checkoutDate.toISOString(),
          targetLateHours,
          pricing.basePrice,
          pricing.totalExtraFee,
          pricing.totalPrice,
          note !== undefined ? (note || null) : existing.note,
          closingNote !== undefined ? (closingNote || null) : existing.closing_note,
          now,
          id
        );

      const logStmt = getLogEventStatement(
        db,
        "BOOKING_UPDATED",
        "booking",
        id,
        {
          oldValues: {
            roomId: existing.room_id,
            bookingType: existing.booking_type,
            checkinAt: existing.checkin_at,
            checkoutAt: existing.checkout_at,
            totalPrice: existing.total_price,
          },
          newValues: {
            roomId: targetRoomId,
            bookingType: targetBookingType,
            checkinAt: checkinDate.toISOString(),
            checkoutAt: checkoutDate.toISOString(),
            totalPrice: pricing.totalPrice,
          },
          staffId: staff.id,
        },
        staff.id
      );

      await db.batch([updateStmt, logStmt]);

      // Adjust member total spend if registered member
      if (priceDelta !== 0 && existing.member_phone) {
        const member = await lookupMember(db, existing.member_phone);
        if (member) {
          const updatedSpent = Math.max(0, (member.total_spent || 0) + priceDelta);
          const tiers = await getCachedCdpTiers(db);
          const newTier = calculateLoyaltyTier(updatedSpent, member.total_bookings, tiers);
          await db
            .prepare(
              `UPDATE members SET total_spent = ?, loyalty_tier = ?, updated_at = ? WHERE phone = ?`
            )
            .bind(updatedSpent, newTier, now, existing.member_phone)
            .run();
        }
      }

      invalidatePrefix("dashboard:gantt:");

      return NextResponse.json({
        success: true,
        message: "Cập nhật thông tin đặt phòng thành công.",
        booking: {
          ...existing,
          room_id: targetRoomId,
          room_name: targetRoom.name,
          room_class: targetRoom.room_class,
          booking_type: targetBookingType,
          checkin_at: checkinDate.toISOString(),
          checkout_at: checkoutDate.toISOString(),
          late_checkout_hours: targetLateHours,
          base_price: pricing.basePrice,
          extra_fee: pricing.totalExtraFee,
          total_price: pricing.totalPrice,
          note: note !== undefined ? (note || null) : existing.note,
          closing_note: closingNote !== undefined ? (closingNote || null) : existing.closing_note,
        },
      });
    }

    return NextResponse.json({ error: "Hành động không hợp lệ." }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH booking error:", error);
    return NextResponse.json({ error: error.message || "Lỗi cập nhật đặt phòng." }, { status: 500 });
  }
}

