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

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

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
        `SELECT 
           b.*, 
           r.name as room_name, 
           r.room_class, 
           creator.full_name as created_by_staff_name,
           updater.full_name as updated_by_staff_name,
           no_shower.full_name as no_show_by_staff_name,
           reminder_sender.full_name as deposit_reminder_sent_by_staff_name,
           remaining_receiver.full_name as remaining_paid_by_staff_name
         FROM bookings b
         LEFT JOIN rooms r ON b.room_id = r.id
         LEFT JOIN staff creator ON b.created_by_staff_id = creator.id
         LEFT JOIN staff updater ON b.updated_by_staff_id = updater.id
         LEFT JOIN staff no_shower ON b.no_show_by = no_shower.id
         LEFT JOIN staff reminder_sender ON b.deposit_reminder_sent_by = reminder_sender.id
         LEFT JOIN staff remaining_receiver ON b.remaining_paid_by = remaining_receiver.id
         WHERE b.id = ?
         LIMIT 1`
      )
      .bind(id)
      .first<Booking>();

    if (!booking) {
      return NextResponse.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    }

    return NextResponse.json({ booking }, { headers: NO_CACHE_HEADERS });
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

    // ── ACTION: NO SHOW ───────────────────────────────────────────
    if (action === "no_show") {
      if (existing.status !== "confirmed") {
        return NextResponse.json(
          { error: "Chỉ có thể đánh dấu No-Show cho đơn đặt phòng đang có hiệu lực (Đã xác nhận)." },
          { status: 400 }
        );
      }

      // Check if checkout time has already passed
      const checkoutDate = new Date(existing.checkout_at);
      const currentDate = new Date();
      if (currentDate > checkoutDate) {
        return NextResponse.json(
          { error: "Đơn đặt phòng này đã qua thời gian checkout. Không thể thao tác No-Show." },
          { status: 400 }
        );
      }

      const rawRefund = Number(body.refundAmount || 0);
      const refundAmount = isNaN(rawRefund) || rawRefund < 0 ? 0 : Math.round(rawRefund);

      const actualCashReceived =
        existing.is_deposit === 1
          ? existing.paid_amount || existing.deposit_amount || 0
          : existing.total_price;

      if (refundAmount > actualCashReceived) {
        return NextResponse.json(
          {
            error: `Số tiền hoàn (${refundAmount.toLocaleString(
              "vi-VN"
            )} đ) không được lớn hơn số tiền thực tế khách đã đóng (${actualCashReceived.toLocaleString(
              "vi-VN"
            )} đ).`,
          },
          { status: 400 }
        );
      }

      const originalPrice = existing.total_price;
      const netRetained = actualCashReceived - refundAmount;
      const noShowReason = (body.noShowReason || body.reason || "Khách không đến / Hủy vi phạm quy định").trim();

      // Build note update
      const refundNote =
        refundAmount > 0
          ? `[NO-SHOW] Hoàn lại: ${refundAmount.toLocaleString(
              "vi-VN"
            )}đ, Thực thu giữ: ${netRetained.toLocaleString(
              "vi-VN"
            )}đ. Lý do: ${noShowReason}`
          : `[NO-SHOW] Không hoàn tiền (giữ 100% ${originalPrice.toLocaleString(
              "vi-VN"
            )}đ). Lý do: ${noShowReason}`;

      const updatedNote = existing.note ? `${existing.note} | ${refundNote}` : refundNote;

      const updateBookingStmt = db
        .prepare(
          `UPDATE bookings SET
            status = 'no_show',
            no_show_at = ?,
            no_show_by = ?,
            no_show_reason = ?,
            refund_amount = ?,
            original_price = ?,
            total_price = ?,
            note = ?,
            updated_at = ?,
            updated_by_staff_id = ?,
            mod_no = mod_no + 1
           WHERE id = ?`
        )
        .bind(
          now,
          staff.id,
          noShowReason,
          refundAmount,
          originalPrice,
          netRetained,
          updatedNote,
          now,
          staff.id,
          id
        );

      // Mini CDP: Increment no_show_count for member, deduct refundAmount from total_spent, and recalculate loyalty_tier
      const member = existing.member_phone ? await lookupMember(db, existing.member_phone) : null;
      const updatedSpent = Math.max(0, (member?.total_spent || 0) - refundAmount);
      const tiers = await getCachedCdpTiers(db);
      const newTier = calculateLoyaltyTier(updatedSpent, member?.total_bookings || 1, tiers);

      const updateMemberStmt = db
        .prepare(
          `UPDATE members SET
            no_show_count = no_show_count + 1,
            total_spent = ?,
            loyalty_tier = ?,
            updated_at = ?,
            mod_no = mod_no + 1
           WHERE phone = ?`
        )
        .bind(updatedSpent, newTier, now, existing.member_phone);

      const logStmt = getLogEventStatement(
        db,
        "BOOKING_NO_SHOW",
        "booking",
        id,
        {
          originalPrice,
          refundAmount,
          netRetained,
          noShowReason,
          noShowByStaffId: staff.id,
        },
        staff.id
      );

      await db.batch([updateBookingStmt, updateMemberStmt, logStmt]);
      invalidatePrefix("dashboard:gantt:");

      return NextResponse.json({
        success: true,
        message:
          refundAmount > 0
            ? `Đã đánh dấu No-Show thành công. Đã hoàn ${refundAmount.toLocaleString(
                "vi-VN"
              )} đ, thực thu giữ ${netRetained.toLocaleString("vi-VN")} đ.`
            : `Đã đánh dấu No-Show thành công. Khách sạn thu giữ 100% (${netRetained.toLocaleString(
                "vi-VN"
              )} đ).`,
        netRetained,
        refundAmount,
      });
    }

    // ── ACTION: CANCEL / HARD DELETE ─────────────────────────────
    if (action === "cancel") {
      const cancelReason = body.cancelReason || "Lễ tân hủy/xóa đặt phòng";
      return await executeHardDeleteBooking(db, existing, staff, cancelReason);
    }

    // ── ACTION: COMPLETE DEPOSIT PAYMENT (BỔ SUNG THANH TOÁN PHẦN CÒN LẠI) ─
    if (action === "complete_deposit_payment") {
      if (existing.is_deposit !== 1) {
        return NextResponse.json(
          { error: "Đơn đặt phòng này không phải đơn đặt cọc." },
          { status: 400 }
        );
      }
      if (existing.deposit_status === "fully_paid") {
        return NextResponse.json(
          { error: "Đơn đặt phòng này đã được thanh toán đủ 100% trước đó." },
          { status: 400 }
        );
      }
      if (existing.status === "cancelled" || existing.status === "no_show") {
        return NextResponse.json(
          { error: "Không thể bổ sung thanh toán cho đơn đặt phòng đã hủy hoặc No-Show." },
          { status: 400 }
        );
      }

      const rawAmount = Number(body.paymentAmount !== undefined ? body.paymentAmount : existing.remaining_amount);
      const paymentAmount = isNaN(rawAmount) || rawAmount <= 0 ? 0 : Math.round(rawAmount);

      if (paymentAmount <= 0) {
        return NextResponse.json(
          { error: "Vui lòng nhập số tiền thanh toán hợp lệ (lớn hơn 0)." },
          { status: 400 }
        );
      }

      const newPaidAmount = (existing.paid_amount || 0) + paymentAmount;
      const newRemainingAmount = Math.max(0, existing.total_price - newPaidAmount);
      const newDepositStatus = newRemainingAmount === 0 ? "fully_paid" : "deposit_paid";
      const noteAppend = body.note?.trim()
        ? `\n[${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${now.slice(0, 10)}] Thu cọc nốt: +${paymentAmount.toLocaleString("vi-VN")}đ (${body.note.trim()})`
        : "";
      const updatedNote = (existing.note || "") + noteAppend;

      const updateStmt = db
        .prepare(
          `UPDATE bookings SET
            paid_amount = ?,
            remaining_amount = ?,
            deposit_status = ?,
            remaining_paid_at = ?,
            remaining_paid_by = ?,
            note = ?,
            updated_at = ?,
            updated_by_staff_id = ?,
            mod_no = mod_no + 1
          WHERE id = ?`
        )
        .bind(
          newPaidAmount,
          newRemainingAmount,
          newDepositStatus,
          now,
          staff.id,
          updatedNote,
          now,
          staff.id,
          id
        );

      const logStmt = getLogEventStatement(
        db,
        "BOOKING_DEPOSIT_COMPLETED",
        "booking",
        id,
        {
          bookingId: id,
          previousPaid: existing.paid_amount || existing.deposit_amount,
          paymentAmount,
          newPaidAmount,
          remainingAmount: newRemainingAmount,
          depositStatus: newDepositStatus,
          note: body.note || null,
          staffId: staff.id,
        },
        staff.id
      );

      const batchStmts: any[] = [updateStmt, logStmt];

      // Update Member CDP total_spent & recalculate loyalty tier
      if (existing.member_phone && paymentAmount > 0) {
        const member = await lookupMember(db, existing.member_phone);
        if (member) {
          const updatedSpent = (member.total_spent || 0) + paymentAmount;
          const tiers = await getCachedCdpTiers(db);
          const newTier = calculateLoyaltyTier(updatedSpent, member.total_bookings || 1, tiers);
          const updateMemberStmt = db
            .prepare(
              `UPDATE members SET
                total_spent = ?,
                loyalty_tier = ?,
                updated_at = ?,
                mod_no = mod_no + 1
               WHERE phone = ?`
            )
            .bind(updatedSpent, newTier, now, existing.member_phone);
          batchStmts.push(updateMemberStmt);
        }
      }

      await db.batch(batchStmts);
      invalidatePrefix("dashboard:gantt:");

      return NextResponse.json({
        success: true,
        message:
          newDepositStatus === "fully_paid"
            ? `Đã thu đủ ${paymentAmount.toLocaleString("vi-VN")} đ. Đơn đặt phòng #${id} đã hoàn tất thanh toán 100%! 🎉`
            : `Đã thu thêm ${paymentAmount.toLocaleString("vi-VN")} đ. Còn lại: ${newRemainingAmount.toLocaleString("vi-VN")} đ.`,
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        depositStatus: newDepositStatus,
      });
    }

    // ── ACTION: MARK DEPOSIT REMINDER SENT (ĐÃ GỬI NHẮC CỌC) ────────
    if (action === "mark_deposit_reminder_sent") {
      if (existing.is_deposit !== 1) {
        return NextResponse.json(
          { error: "Đơn đặt phòng này không phải đơn đặt cọc." },
          { status: 400 }
        );
      }

      const updateStmt = db
        .prepare(
          `UPDATE bookings SET
            deposit_reminder_sent_at = ?,
            deposit_reminder_sent_by = ?,
            updated_at = ?,
            updated_by_staff_id = ?,
            mod_no = mod_no + 1
          WHERE id = ?`
        )
        .bind(now, staff.id, now, staff.id, id);

      const logStmt = getLogEventStatement(
        db,
        "BOOKING_DEPOSIT_REMINDER_SENT",
        "booking",
        id,
        {
          bookingId: id,
          reminderSentAt: now,
          staffId: staff.id,
        },
        staff.id
      );

      await db.batch([updateStmt, logStmt]);

      return NextResponse.json({
        success: true,
        message: `Đã ghi nhận gửi nhắc cọc cho đơn #${id} thành công.`,
        depositReminderSentAt: now,
      });
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
      const isDepositBooking = existing.is_deposit === 1;
      const newRemainingAmount = isDepositBooking
        ? Math.max(0, newTotalPrice - (existing.paid_amount || 0))
        : 0;
      const newDepositStatus = isDepositBooking
        ? (newRemainingAmount === 0 ? "fully_paid" : "deposit_paid")
        : (existing.deposit_status || "none");

      const updateStmt = db
        .prepare(
          `UPDATE bookings SET
            checkout_at = ?,
            extra_fee = ?,
            total_price = ?,
            late_checkout_hours = ?,
            remaining_amount = ?,
            deposit_status = ?,
            updated_at = ?,
            updated_by_staff_id = ?,
            mod_no = mod_no + 1
           WHERE id = ?`
        )
        .bind(
          newCheckoutIso,
          newExtraFee,
          newTotalPrice,
          newLateHours,
          newRemainingAmount,
          newDepositStatus,
          now,
          staff.id,
          id
        );

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
          updated_at: now,
          updated_by_staff_id: staff.id,
          updated_by_staff_name: staff.full_name,
          mod_no: (existing.mod_no || 0) + 1,
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

      const isDepositBooking = existing.is_deposit === 1;
      const newRemaining = isDepositBooking
        ? Math.max(0, pricing.totalPrice - (existing.paid_amount || 0))
        : existing.remaining_amount || 0;
      const newDepositStatus = isDepositBooking
        ? (newRemaining === 0 ? "fully_paid" : "deposit_paid")
        : (existing.deposit_status || "none");

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
            remaining_amount = ?,
            deposit_status = ?,
            note = ?,
            closing_note = ?,
            updated_at = ?,
            updated_by_staff_id = ?,
            mod_no = mod_no + 1
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
          newRemaining,
          newDepositStatus,
          note !== undefined ? (note || null) : existing.note,
          closingNote !== undefined ? (closingNote || null) : existing.closing_note,
          now,
          staff.id,
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
          updated_at: now,
          updated_by_staff_id: staff.id,
          updated_by_staff_name: staff.full_name,
          mod_no: (existing.mod_no || 0) + 1,
        },
      });
    }

    return NextResponse.json({ error: "Hành động không hợp lệ." }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH booking error:", error);
    return NextResponse.json({ error: error.message || "Lỗi cập nhật đặt phòng." }, { status: 500 });
  }
}

/**
 * Common logic to HARD DELETE a booking and roll back member CDP statistics.
 */
async function executeHardDeleteBooking(
  db: any,
  existing: Booking,
  staff: { id: number },
  cancelReason: string = "Lễ tân hủy/xóa"
) {
  const now = new Date().toISOString();

  // 1. Delete booking completely from database (Hard delete)
  const deleteBookingStmt = db.prepare("DELETE FROM bookings WHERE id = ?").bind(existing.id);
  const statements: any[] = [deleteBookingStmt];

  // 2. Roll back member CDP stats if member exists
  const member = await lookupMember(db, existing.member_phone);
  if (member) {
    const isNightStay = existing.booking_type === "overnight" || existing.booking_type === "dayuse";
    const nightsToDeduct = isNightStay ? 1 : 0;

    const updatedBookings = Math.max(0, (member.total_bookings || 0) - 1);
    const amountToDeduct =
      existing.is_deposit === 1
        ? (existing.paid_amount ?? existing.deposit_amount ?? 0)
        : (existing.total_price || 0);
    const updatedSpent = Math.max(0, (member.total_spent || 0) - amountToDeduct);
    const updatedNights = Math.max(0, (member.total_nights || 0) - nightsToDeduct);
    const updatedNoShow =
      existing.status === "no_show"
        ? Math.max(0, (member.no_show_count || 0) - 1)
        : (member.no_show_count || 0);

    const tiers = await getCachedCdpTiers(db);
    const updatedTier = calculateLoyaltyTier(updatedSpent, updatedBookings, tiers);

    const updateMemberStmt = db
      .prepare(
        `UPDATE members SET
          total_bookings = ?,
          total_spent = ?,
          total_nights = ?,
          no_show_count = ?,
          loyalty_tier = ?,
          updated_at = ?,
          mod_no = mod_no + 1
         WHERE phone = ?`
      )
      .bind(
        updatedBookings,
        updatedSpent,
        updatedNights,
        updatedNoShow,
        updatedTier,
        now,
        existing.member_phone
      );

    statements.push(updateMemberStmt);
  }

  // 3. Log audit event
  const logStmt = getLogEventStatement(
    db,
    "BOOKING_HARD_DELETED",
    "booking",
    existing.id,
    {
      bookingId: existing.id,
      room_id: existing.room_id,
      member_phone: existing.member_phone,
      member_name: existing.member_name,
      checkin_at: existing.checkin_at,
      checkout_at: existing.checkout_at,
      total_price: existing.total_price,
      booking_type: existing.booking_type,
      status: existing.status,
      deletedByStaffId: staff.id,
      cancelReason,
    },
    staff.id
  );
  statements.push(logStmt);

  // Execute batch atomically
  await db.batch(statements);

  // Invalidate Gantt cache
  invalidatePrefix("dashboard:gantt:");

  return NextResponse.json({
    success: true,
    message: `Đã xóa hoàn toàn đặt phòng #${existing.id} và cập nhật lại hồ sơ CDP.`,
  });
}

export async function DELETE(
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
    const body = (await req.json().catch(() => ({}))) as any;
    const cancelReason = body?.cancelReason || "Lễ tân hủy/xóa đặt phòng";

    const existing = await db
      .prepare("SELECT * FROM bookings WHERE id = ?")
      .bind(id)
      .first<Booking>();

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy thông tin đặt phòng." }, { status: 404 });
    }

    return await executeHardDeleteBooking(db, existing, staff, cancelReason);
  } catch (error: any) {
    console.error("DELETE booking error:", error);
    return NextResponse.json({ error: error.message || "Lỗi hệ thống khi xóa đặt phòng." }, { status: 500 });
  }
}

