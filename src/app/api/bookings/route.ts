import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse } from "@/lib/cores";
import { toLegacyBookingRow, type CoreBookingListResponse } from "@/lib/coreMappers";
import { generateBookingId } from "@/lib/bookingId";
import { calculatePrice } from "@/lib/pricing";
import { upsertMemberOnBooking, lookupMember } from "@/lib/cdp";
import { evaluatePromotion } from "@/lib/promotions";
import { logEvent } from "@/lib/audit";
import { BookingType } from "@/types";
import { getCachedRooms, getCachedPricingRules } from "@/lib/masterData";
import { invalidatePrefix } from "@/lib/cache";
import { checkBookingOverlapWithBuffer } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Legacy behaviour: a search of 1–2 characters is ignored rather than rejected. Forwarding it
    // would make Booking Core return 400 (it enforces a 3-char minimum), so filter it out here.
    const rawSearch = searchParams.get("search")?.trim() ?? "";
    const search = rawSearch.length >= 3 ? rawSearch : "";

    // Filter/sort/pagination params are contract-identical to Booking Core — forward as-is.
    const query: Record<string, string> = {};
    for (const key of ["date", "roomId", "status", "bookingType", "depositStatus", "createdBy", "createdFrom", "createdTo", "sortBy", "sortDir", "page"] as const) {
      const v = searchParams.get(key)?.trim();
      if (v) query[key] = v;
    }
    if (search) query.search = search;
    const pageSize = searchParams.get("pageSize") ?? searchParams.get("limit");
    if (pageSize) query.pageSize = pageSize;

    const res = await bookingCore.get<CoreBookingListResponse>("/internal/v1/bookings", {
      staff,
      query,
      ifNoneMatch: req.headers.get("if-none-match"),
    });

    if (res.status === 304) {
      return new NextResponse(null, { status: 304, headers: { ETag: res.etag ?? "", "Cache-Control": "no-cache" } });
    }

    const data = res.data!;
    const body = {
      bookings: data.bookings.map(toLegacyBookingRow),
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    };

    const headers: Record<string, string> = { ...NO_CACHE_HEADERS };
    if (res.etag) headers.ETag = res.etag;
    return NextResponse.json(body, { headers });
  } catch (error) {
    console.error("GET bookings error:", error);
    return coreErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const staff = await getCurrentStaff(db);
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const {
      roomId,
      phone,
      name,
      instagram = "",
      facebook = "",
      closingNote = "",
      closing_note = "",
      numGuests = 2,
      bookingType,
      checkinAt,
      checkoutAt,
      lateCheckoutHours = 0,
      customPrice = 0,
      discountAmount = 0,
      discount_amount = 0,
      promotionId = "",
      promotion_id = "",
      promotionCode = "",
      promotion_code = "",
      note = "",
      status = "confirmed",
      isDeposit = false,
      is_deposit = false,
      depositAmount = 0,
      deposit_amount = 0,
      depositDueDate = "",
      deposit_due_date = "",
    } = body;

    // Basic validation
    if (!roomId || !phone || !name || !bookingType || !checkinAt || !checkoutAt) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ các thông tin bắt buộc." },
        { status: 400 }
      );
    }

    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const cleanInstagram = (instagram || "").trim();
    const cleanFacebook = (facebook || "").trim();
    const cleanClosingNote = (closingNote || closing_note || "").trim();

    // Mandatory: At least 1 of Instagram or Facebook
    if (!cleanInstagram && !cleanFacebook) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên tài khoản Instagram hoặc Facebook (bắt buộc phải có ít nhất 1 trong 2)." },
        { status: 400 }
      );
    }

    // Custom booking type price validation
    if (bookingType === "custom") {
      const priceNum = Number(customPrice);
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json(
          { error: "Vui lòng nhập số tiền hợp lệ cho đơn đặt phòng tuỳ chỉnh." },
          { status: 400 }
        );
      }
    }

    const checkinDate = new Date(checkinAt);
    const checkoutDate = new Date(checkoutAt);

    if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
      return NextResponse.json(
        { error: "Thời gian check-in hoặc check-out không hợp lệ." },
        { status: 400 }
      );
    }

    if (checkoutDate <= checkinDate) {
      return NextResponse.json(
        { error: "Thời gian check-out phải sau thời gian check-in." },
        { status: 400 }
      );
    }

    // 1. Fetch Room details from cached master data
    const rooms = await getCachedRooms(db);
    const room = rooms.find((r) => r.id === roomId && r.is_active === 1);

    if (!room) {
      return NextResponse.json({ error: "Phòng không tồn tại hoặc đã ngừng hoạt động." }, { status: 404 });
    }

    // 2. Overlap & 1h turnover cleaning buffer collision check
    const checkinIso = checkinDate.toISOString();
    const checkoutIso = checkoutDate.toISOString();

    const overlapResult = await checkBookingOverlapWithBuffer(
      db,
      {
        roomId,
        checkinAt: checkinIso,
        checkoutAt: checkoutIso,
      },
      room.name
    );

    if (overlapResult.hasOverlap) {
      return NextResponse.json(
        { error: overlapResult.errorMessage || "Khung giờ phòng đã bị trùng lặp hoặc chưa đủ 1 giờ dọn phòng." },
        { status: 409 }
      );
    }

    // 3. Fetch Pricing Rules from cached master data
    const pricingRules = await getCachedPricingRules(db);

    // 4. Calculate locked price snapshot & validate promotion
    const basePricing = calculatePrice({
      bookingType: bookingType as BookingType,
      roomClass: room.room_class,
      checkinAt: checkinDate,
      checkoutAt: checkoutDate,
      lateCheckoutHours: Number(lateCheckoutHours) || 0,
      pricingRules,
      customPrice: Number(customPrice) || 0,
      discountAmount: 0,
    });

    let appliedDiscountAmount = Number(discountAmount || discount_amount) || 0;
    let appliedPromoId: string | null = null;
    let appliedPromoCode: string | null = null;

    const requestedPromo = (promotionId || promotion_id || promotionCode || promotion_code || "").trim();
    if (requestedPromo) {
      const promoRow = await db
        .prepare(
          `SELECT p.*, c.name as category_name
           FROM promotions p
           LEFT JOIN promotion_categories c ON p.category_id = c.id
           WHERE p.id = ? OR p.code = ?
           LIMIT 1`
        )
        .bind(requestedPromo, requestedPromo.toUpperCase())
        .first<any>();

      if (promoRow) {
        const member = await lookupMember(db, cleanPhone);
        const parsedPromo = {
          ...promoRow,
          applicable_room_classes:
            typeof promoRow.applicable_room_classes === "string"
              ? JSON.parse(promoRow.applicable_room_classes)
              : promoRow.applicable_room_classes || [],
          applicable_booking_types:
            typeof promoRow.applicable_booking_types === "string"
              ? JSON.parse(promoRow.applicable_booking_types)
              : promoRow.applicable_booking_types || [],
          applicable_loyalty_tiers:
            typeof promoRow.applicable_loyalty_tiers === "string"
              ? JSON.parse(promoRow.applicable_loyalty_tiers)
              : promoRow.applicable_loyalty_tiers || [],
          applicable_days_of_week:
            typeof promoRow.applicable_days_of_week === "string"
              ? JSON.parse(promoRow.applicable_days_of_week)
              : promoRow.applicable_days_of_week || [0, 1, 2, 3, 4, 5, 6],
        };

        const promoEval = evaluatePromotion(parsedPromo, {
          roomClass: room.room_class,
          bookingType: bookingType as BookingType,
          checkinAt: checkinDate,
          rawSubtotal: basePricing.basePrice + basePricing.totalExtraFee,
          memberTier: member?.loyalty_tier || "new",
        });

        if (promoEval.eligible) {
          appliedDiscountAmount = promoEval.discountAmount;
          appliedPromoId = parsedPromo.id;
          appliedPromoCode = parsedPromo.code || null;

          // Increment used_count for promotion
          await db
            .prepare("UPDATE promotions SET used_count = used_count + 1 WHERE id = ?")
            .bind(parsedPromo.id)
            .run();
        }
      }
    }

    const pricing = calculatePrice({
      bookingType: bookingType as BookingType,
      roomClass: room.room_class,
      checkinAt: checkinDate,
      checkoutAt: checkoutDate,
      lateCheckoutHours: Number(lateCheckoutHours) || 0,
      pricingRules,
      customPrice: Number(customPrice) || 0,
      discountAmount: appliedDiscountAmount,
    });

    const bookingId = generateBookingId();
    const nowIso = new Date().toISOString();

    const isDepositVal = Boolean(isDeposit || is_deposit) ? 1 : 0;
    let depositAmt = 0;
    let paidAmt = pricing.totalPrice;
    let remainingAmt = 0;
    let depositStat = "none";
    let depositDue: string | null = null;
    let depositPaidDate: string | null = null;

    if (isDepositVal === 1) {
      const rawDeposit = Math.round(Number(depositAmount || deposit_amount) || 0);
      depositAmt = Math.max(0, Math.min(rawDeposit, pricing.totalPrice));
      paidAmt = depositAmt;
      remainingAmt = Math.max(0, pricing.totalPrice - paidAmt);
      depositStat = remainingAmt === 0 ? "fully_paid" : "deposit_paid";
      depositDue = (depositDueDate || deposit_due_date || "").trim() || checkinIso.slice(0, 10);
      depositPaidDate = nowIso;
    }

    // 5. Insert Booking with Control Fields, Promotion & Deposit (mod_no=0, created_by, updated_by)
    await db
      .prepare(
        `INSERT INTO bookings (
          id, property_id, room_id, member_phone, member_name, instagram, facebook, num_guests,
          booking_type, checkin_at, checkout_at, late_checkout_hours, closing_note, note,
          created_by_staff_id, updated_by_staff_id, mod_no, status, base_price, extra_fee, discount_amount, total_price,
          promotion_id, promotion_code, is_deposit, deposit_amount, paid_amount, remaining_amount,
          deposit_due_date, deposit_status, deposit_paid_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )`
      )
      .bind(
        bookingId,
        room.property_id,
        room.id,
        cleanPhone,
        cleanName,
        cleanInstagram || null,
        cleanFacebook || null,
        Number(numGuests) || 2,
        bookingType,
        checkinIso,
        checkoutIso,
        Number(lateCheckoutHours) || 0,
        cleanClosingNote || null,
        note,
        staff.id,
        staff.id,
        0,
        status,
        pricing.basePrice,
        pricing.totalExtraFee,
        pricing.discountAmount,
        pricing.totalPrice,
        appliedPromoId,
        appliedPromoCode,
        isDepositVal,
        depositAmt,
        paidAmt,
        remainingAmt,
        depositDue,
        depositStat,
        depositPaidDate,
        nowIso,
        nowIso
      )
      .run();

    // 6. CDP: Upsert member and recalculate loyalty tier (updates instagram/facebook by phone)
    // For deposit bookings, only credit actual cash received (paidAmt) to total_spent; remainder is credited when completed
    const cdpResult = await upsertMemberOnBooking(db, {
      phone: cleanPhone,
      name: cleanName,
      instagram: cleanInstagram,
      facebook: cleanFacebook,
      totalPrice: isDepositVal === 1 ? paidAmt : pricing.totalPrice,
      bookingType: bookingType as BookingType,
      roomClass: room.room_class,
      staffId: staff.id,
    });

    // 7. Audit Log
    await logEvent(
      db,
      "BOOKING_CREATED",
      "booking",
      bookingId,
      {
        bookingId,
        roomId: room.id,
        roomName: room.name,
        phone: cleanPhone,
        name: cleanName,
        instagram: cleanInstagram,
        facebook: cleanFacebook,
        totalPrice: pricing.totalPrice,
        bookingType,
        isDeposit: isDepositVal,
        depositAmount: depositAmt,
        paidAmount: paidAmt,
        remainingAmount: remainingAmt,
        depositDueDate: depositDue,
        depositStatus: depositStat,
      },
      staff.id
    );

    // Invalidate dashboard gantt cache
    invalidatePrefix("dashboard:gantt:");

    return NextResponse.json({
      success: true,
      booking: {
        id: bookingId,
        roomId: room.id,
        roomName: room.name,
        roomClass: room.room_class,
        phone: cleanPhone,
        name: cleanName,
        instagram: cleanInstagram,
        facebook: cleanFacebook,
        closingNote: cleanClosingNote,
        bookingType,
        checkinAt: checkinIso,
        checkoutAt: checkoutIso,
        totalPrice: pricing.totalPrice,
        status,
        isDeposit: isDepositVal,
        depositAmount: depositAmt,
        paidAmount: paidAmt,
        remainingAmount: remainingAmt,
        depositDueDate: depositDue,
        depositStatus: depositStat,
      },
      cdp: cdpResult,
    });
  } catch (error: any) {
    console.error("POST booking error:", error);
    return NextResponse.json(
      { error: error?.message || "Đã xảy ra lỗi khi tạo đặt phòng." },
      { status: 500 }
    );
  }
}
