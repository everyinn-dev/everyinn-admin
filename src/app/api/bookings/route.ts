import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { bookingCore, coreErrorResponse, newIdempotencyKey } from "@/lib/cores";
import {
  toLegacyBookingRow,
  type CoreBookingEnvelope,
  type CoreBookingListResponse,
  type CoreQuoteResponse,
} from "@/lib/coreMappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

/** Core accepts 8–128 chars of [A-Za-z0-9._:-]. */
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

/** Legacy form has no payment-method selector yet (A-W6); every manual collection is recorded as cash. */
const DEFAULT_PAYMENT_METHOD = "cash";

export async function GET(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
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

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

/**
 * Create a manual booking via Booking Core (A-W1b).
 *
 * Booking Core is the single authority for room availability + 1h turnover buffer, pricing, promotion
 * eligibility/redemption, financial ledger and loyalty accrual (outbox → CDP). The BFF only validates the
 * request shape, translates legacy field names to the Core contract, and maps the result back to the UI shape.
 *
 * Legacy semantics preserved:
 *  - A non-deposit booking is collected in full at creation → recorded as a `payment` for the quoted total.
 *  - A deposit booking records `deposit` (+ due date); the remainder is settled later (A-W2).
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const roomId = String(body.roomId ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const name = String(body.name ?? "").trim();
    const bookingType = String(body.bookingType ?? "").trim();
    const instagram = String(body.instagram ?? "").trim();
    const facebook = String(body.facebook ?? "").trim();

    if (!roomId || !phone || !name || !bookingType || !body.checkinAt || !body.checkoutAt) {
      return bad("Vui lòng điền đầy đủ các thông tin bắt buộc.");
    }
    if (!instagram && !facebook) {
      return bad("Vui lòng nhập tên tài khoản Instagram hoặc Facebook (bắt buộc phải có ít nhất 1 trong 2).");
    }

    const checkin = new Date(body.checkinAt as string);
    const checkout = new Date(body.checkoutAt as string);
    if (Number.isNaN(checkin.getTime()) || Number.isNaN(checkout.getTime())) {
      return bad("Thời gian check-in hoặc check-out không hợp lệ.");
    }
    if (checkout <= checkin) {
      return bad("Thời gian check-out phải sau thời gian check-in.");
    }

    let customPrice: number | undefined;
    if (bookingType === "custom") {
      const n = Number(body.customPrice);
      if (!Number.isFinite(n) || n < 0) return bad("Vui lòng nhập số tiền hợp lệ cho đơn đặt phòng tuỳ chỉnh.");
      customPrice = Math.round(n);
    }

    const promotionId = String(body.promotionId ?? body.promotion_id ?? "").trim() || undefined;
    const promotionCode = String(body.promotionCode ?? body.promotion_code ?? "").trim().toUpperCase() || undefined;
    const closingNote = String(body.closingNote ?? body.closing_note ?? "").trim() || undefined;
    const note = String(body.note ?? "").trim() || undefined;
    const status = body.status === "pending" ? "pending" : "confirmed";
    const lateCheckoutHours = Math.max(0, Math.round(Number(body.lateCheckoutHours) || 0));
    const numGuests = Math.max(1, Math.round(Number(body.numGuests) || 2));

    const stay = {
      roomId,
      bookingType,
      checkinAt: checkin.toISOString(),
      checkoutAt: checkout.toISOString(),
      lateCheckoutHours,
      numGuests,
      customPrice,
    };

    const isDeposit = Boolean(body.isDeposit ?? body.is_deposit);
    const depositAmount = Math.round(Number(body.depositAmount ?? body.deposit_amount) || 0);
    const depositDueDate = String(body.depositDueDate ?? body.deposit_due_date ?? "").trim() || undefined;
    if (isDeposit && depositAmount <= 0) {
      return bad("Vui lòng nhập số tiền cọc hợp lệ.");
    }

    // One user intent == one key. A client that retries (double submit, flaky network) sends the same
    // header and Core replays the original result instead of creating a second booking.
    const headerKey = req.headers.get("idempotency-key")?.trim();
    const idempotencyKey = headerKey && IDEMPOTENCY_KEY_RE.test(headerKey) ? headerKey : newIdempotencyKey("booking-create");

    // Non-deposit bookings are paid in full → we need Core's authoritative total (promotion applied).
    let payment: { amount: number; method: string } | undefined;
    if (!isDeposit) {
      const quote = await bookingCore.post<CoreQuoteResponse>("/internal/v1/quotes", {
        staff,
        body: { ...stay, phone, promotionId, promotionCode },
      });
      const total = quote.data!.quote.totalBeforeLoyalty;
      if (total > 0) payment = { amount: total, method: DEFAULT_PAYMENT_METHOD };
    }

    const res = await bookingCore.post<CoreBookingEnvelope>("/internal/v1/bookings", {
      staff,
      idempotencyKey,
      body: {
        ...stay,
        guest: { name, phone, instagram: instagram || undefined, facebook: facebook || undefined },
        note,
        closingNote,
        status,
        promotionId,
        promotionCode,
        deposit: isDeposit ? { amount: depositAmount, method: DEFAULT_PAYMENT_METHOD, dueDate: depositDueDate } : undefined,
        payment,
      },
    });

    const row = toLegacyBookingRow(res.data!.booking);
    const loyalty = res.data!.booking.loyalty;
    return NextResponse.json({
      success: true,
      replayed: res.data!.replayed ?? false,
      booking: {
        id: row.id,
        roomId: row.room_id,
        roomName: row.room_name,
        roomClass: row.room_class,
        phone: row.member_phone,
        name: row.member_name,
        instagram: row.instagram ?? "",
        facebook: row.facebook ?? "",
        closingNote: row.closing_note ?? "",
        bookingType: row.booking_type,
        checkinAt: row.checkin_at,
        checkoutAt: row.checkout_at,
        totalPrice: row.total_price,
        status: row.status,
        isDeposit: row.is_deposit,
        depositAmount: row.deposit_amount,
        paidAmount: row.paid_amount,
        remainingAmount: row.remaining_amount,
        depositDueDate: row.deposit_due_date,
        depositStatus: row.deposit_status,
        version: row.mod_no,
      },
      // CDP accrual is asynchronous now (outbox → CDP Core); the UI can badge this in A-W8.
      loyalty: { syncStatus: loyalty.syncStatus, tier: loyalty.tier },
    });
  } catch (error) {
    console.error("POST booking error:", error);
    return coreErrorResponse(error);
  }
}
