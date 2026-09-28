import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
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
    const date = searchParams.get("date"); // YYYY-MM-DD
    const roomId = searchParams.get("roomId");
    const status = searchParams.get("status");
    const rawSearch = searchParams.get("search")?.trim() || "";
    // Only trigger search if at least 3 characters entered
    const search = rawSearch.length >= 3 ? rawSearch : "";
    const bookingType = searchParams.get("bookingType")?.trim() || "";
    const depositStatus = searchParams.get("depositStatus")?.trim() || "";
    const createdBy = searchParams.get("createdBy")?.trim() || "";
    const createdFrom = searchParams.get("createdFrom")?.trim() || "";
    const createdTo = searchParams.get("createdTo")?.trim() || "";

    // Sorting
    const sortByParam = searchParams.get("sortBy")?.trim() || "checkin_at";
    const sortDirParam = searchParams.get("sortDir")?.trim()?.toLowerCase() || "desc";

    const allowedSortColumns: Record<string, string> = {
      checkin_at: "b.checkin_at",
      checkout_at: "b.checkout_at",
      created_at: "b.created_at",
      total_price: "b.total_price",
      mod_no: "b.mod_no",
      updated_at: "b.updated_at",
      status: "b.status",
    };
    const sortColumn = allowedSortColumns[sortByParam] || "b.checkin_at";
    const sortDir = sortDirParam === "asc" ? "ASC" : "DESC";

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSizeParam = searchParams.get("pageSize") || searchParams.get("limit");
    const pageSize = Math.min(50, Math.max(1, parseInt(pageSizeParam || "20", 10)));
    const offset = (page - 1) * pageSize;

    // 1. Lightweight Event-Version Check (1 D1 Row Read)
    const eventRow = await db
      .prepare("SELECT COALESCE(MAX(id), 0) as last_event_id FROM event_logs")
      .first<{ last_event_id: number }>();
    const lastEventId = eventRow?.last_event_id || 0;

    const etag = `W/"ev-${lastEventId}-bk-${page}-${pageSize}-${sortByParam}-${sortDirParam}-${roomId || ""}-${status || ""}-${bookingType || ""}-${depositStatus || ""}-${createdBy || ""}-${createdFrom || ""}-${createdTo || ""}-${search}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "no-cache",
        },
      });
    }

    // Base WHERE conditions
    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (roomId && roomId !== "all") {
      whereClause += " AND b.room_id = ?";
      params.push(roomId);
    }

    if (status && status !== "all") {
      whereClause += " AND b.status = ?";
      params.push(status);
    }

    if (depositStatus && depositStatus !== "all") {
      whereClause += " AND b.deposit_status = ?";
      params.push(depositStatus);
    }

    if (bookingType && bookingType !== "all") {
      whereClause += " AND b.booking_type = ?";
      params.push(bookingType);
    }

    if (createdBy && createdBy !== "all") {
      const staffIdNum = parseInt(createdBy, 10);
      if (!isNaN(staffIdNum)) {
        whereClause += " AND b.created_by_staff_id = ?";
        params.push(staffIdNum);
      }
    }

    if (createdFrom) {
      whereClause += " AND b.created_at >= ?";
      params.push(`${createdFrom}T00:00:00`);
    }

    if (createdTo) {
      whereClause += " AND b.created_at <= ?";
      params.push(`${createdTo}T23:59:59`);
    }

    if (search) {
      const searchPattern = `%${search}%`;
      whereClause += ` AND (
        b.member_name LIKE ? OR 
        b.member_phone LIKE ? OR 
        b.instagram LIKE ? OR 
        b.facebook LIKE ? OR 
        b.id LIKE ?
      )`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (date) {
      // Find bookings overlapping with this date
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      whereClause += " AND b.checkin_at <= ? AND b.checkout_at >= ?";
      params.push(endOfDay, startOfDay);
    }

    // 1. Count query for total
    const countSql = `
      SELECT COUNT(*) as count
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN staff creator ON b.created_by_staff_id = creator.id
      LEFT JOIN staff updater ON b.updated_by_staff_id = updater.id
      ${whereClause}
    `;
    const countStmt = db.prepare(countSql);
    const countBound = params.length > 0 ? countStmt.bind(...params) : countStmt;
    const totalResult = await countBound.first<{ count: number }>();
    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // 2. Data query with Control Fields
    const dataSql = `
      SELECT 
        b.*, 
        r.name as room_name, 
        r.room_class, 
        creator.full_name as created_by_staff_name,
        updater.full_name as updated_by_staff_name
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN staff creator ON b.created_by_staff_id = creator.id
      LEFT JOIN staff updater ON b.updated_by_staff_id = updater.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDir}
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, pageSize, offset];
    const dataStmt = db.prepare(dataSql);
    const { results } = await dataStmt.bind(...dataParams).all();

    return NextResponse.json(
      {
        bookings: results || [],
        total,
        page,
        pageSize,
        totalPages,
      },
      {
        headers: {
          ...NO_CACHE_HEADERS,
          ETag: etag,
        },
      }
    );
  } catch (error) {
    console.error("GET bookings error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
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
