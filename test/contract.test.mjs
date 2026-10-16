import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createValidator } from "./helpers/schemaValidator.mjs";
import {
  toLegacyBookingRow,
  toDailyRosterItem,
  toLegacyPromotion,
  toLegacyCategory,
  toLegacyMemberResponse,
} from "../src/lib/coreMappers.ts";

const resolve = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const bookingDoc = JSON.parse(readFileSync(resolve("../contracts/booking-core.openapi.json"), "utf8"));
const cdpDoc = JSON.parse(readFileSync(resolve("../contracts/cdp-core.openapi.json"), "utf8"));

const bookingValidator = createValidator(bookingDoc);
const cdpValidator = createValidator(cdpDoc);

const sampleBookingCanonical = {
  id: "EI-20261016-ABCD",
  propertyId: "everyinn-saigon",
  roomClass: "haven",
  roomId: "room_haven_1",
  roomName: "Haven 1",
  roomNumber: "101",
  customerId: "cdp_cust_1",
  guest: {
    phone: "+84901234567",
    phoneDisplay: "0901 234 567",
    contactRaw: "0901234567",
    name: "Nguyen Van A",
    instagram: "nguyenvana",
    facebook: "fb.me/vana",
  },
  numGuests: 2,
  bookingType: "hourly",
  ratePlanCode: "combo3h",
  checkinAt: "2026-10-16T07:00:00Z",
  checkoutAt: "2026-10-16T10:00:00Z",
  occupiedUntil: "2026-10-16T11:00:00Z",
  lateCheckoutHours: 0,
  status: "confirmed",
  source: "admin",
  note: "Quiet please",
  closingNote: "Near elevator",
  pricing: {
    currency: "VND",
    comboLabel: "Combo 3h",
    durationLabel: "3 giờ",
    rateRule: { id: "rate_haven_3h", version: 1, basePrice: 350000, extraHourFee: 50000 },
    basePrice: 350000,
    extraFee: 0,
    subtotal: 350000,
    promotionDiscount: 0,
    loyaltyDiscount: 0,
    discountAmount: 0,
    totalPrice: 350000,
    originalPrice: 350000,
    lines: [],
    isFinal: true,
  },
  promotion: null,
  loyalty: {
    syncStatus: "synced",
    step: 2,
    tier: "bronze",
    reward: null,
    syncedAt: "2026-10-16T07:05:00Z",
  },
  financial: {
    isDeposit: true,
    depositAmount: 100000,
    paidAmount: 100000,
    refundAmount: 0,
    netPaid: 100000,
    remainingAmount: 250000,
    overpaidAmount: 0,
    depositStatus: "deposit_paid",
    depositDueDate: "2026-10-16",
    depositPaidAt: "2026-10-16T06:30:00Z",
    depositReminderSentAt: null,
    depositReminderSentBy: null,
    remainingPaidAt: null,
    remainingPaidBy: null,
  },
  lifecycle: {
    confirmedAt: "2026-10-16T06:00:00Z",
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    noShowAt: null,
    noShowBy: null,
    noShowReason: null,
  },
  control: {
    version: 1,
    createdAt: "2026-10-16T06:00:00Z",
    createdBy: { id: 1, name: "Manager" },
    updatedAt: "2026-10-16T06:00:00Z",
    updatedBy: { id: 1, name: "Manager" },
  },
  reconciliationStatus: "ok",
};

test("Consumer contract: Booking Core Envelope matches schema and maps cleanly to legacy UI", () => {
  const sampleBookingEnvelope = {
    booking: sampleBookingCanonical,
  };

  const errors = bookingValidator.validateSchema("#/components/schemas/BookingEnvelope", sampleBookingEnvelope);
  assert.deepEqual(errors, [], `BookingEnvelope schema validation failed: ${errors.join(", ")}`);

  const legacy = toLegacyBookingRow(sampleBookingCanonical);
  assert.equal(legacy.id, "EI-20261016-ABCD");
  assert.equal(legacy.member_phone, "0901 234 567");
  assert.equal(legacy.member_name, "Nguyen Van A");
  assert.equal(legacy.room_name, "Haven 1");
  assert.equal(legacy.version, 1);
  assert.equal(legacy.loyalty_sync_status, "synced");
  assert.equal(legacy.total_price, 350000);
});

test("Consumer contract: Daily Roster and RosterItem match schema and map cleanly", () => {
  const sampleRosterItem = {
    id: "EI-20261016-ABCD",
    roomId: "room_haven_1",
    roomName: "Haven 1",
    roomNumber: "101",
    roomClass: "haven",
    guestName: "Nguyen Van A",
    phone: "0901234567",
    instagram: "nguyenvana",
    facebook: "fb.me/vana",
    bookingType: "hourly",
    ratePlanCode: "combo3h",
    checkinAt: "2026-10-16T07:00:00Z",
    checkoutAt: "2026-10-16T10:00:00Z",
    turnoverStartAt: "2026-10-16T10:00:00Z",
    turnoverEndAt: "2026-10-16T11:00:00Z",
    lateCheckoutHours: 0,
    totalPrice: 350000,
    remainingAmount: 0,
    status: "confirmed",
    loyaltySyncStatus: "synced",
    loyaltyTier: "bronze",
    loyaltyStep: 2,
    closingNote: null,
    note: "Quiet please",
    createdAt: "2026-10-16T06:00:00Z",
    createdBy: { id: 1, name: "Quan ly" },
    updatedAt: "2026-10-16T06:00:00Z",
    version: 1,
  };

  const itemErrors = bookingValidator.validateSchema("#/components/schemas/RosterItem", sampleRosterItem);
  assert.deepEqual(itemErrors, [], `RosterItem schema validation failed: ${itemErrors.join(", ")}`);

  const sampleRoster = {
    date: "2026-10-16",
    summary: {
      totalCheckins: 1,
      totalCheckouts: 0,
      hourlyCount: 1,
      overnightCount: 0,
      dayuseCount: 0,
      customCount: 0,
      loyaltyPendingCount: 0,
    },
    checkins: [sampleRosterItem],
    checkouts: [],
  };

  const rosterErrors = bookingValidator.validateSchema("#/components/schemas/Roster", sampleRoster);
  assert.deepEqual(rosterErrors, [], `Roster schema validation failed: ${rosterErrors.join(", ")}`);

  const mapped = toDailyRosterItem(sampleRosterItem);
  assert.equal(mapped.id, "EI-20261016-ABCD");
  assert.equal(mapped.roomName, "Haven 1");
  assert.equal(mapped.floor, 1);
  assert.equal(mapped.loyaltyTier, "bronze");
});

test("Consumer contract: Deposit Reminders response matches schema and maps to bookings", () => {
  const sampleDepositReminders = {
    reminders: [sampleBookingCanonical],
    count: 1,
    today: "2026-10-16",
  };

  const errors = bookingValidator.validateResponse("/internal/v1/deposit-reminders", "GET", 200, sampleDepositReminders);
  assert.deepEqual(errors, [], `deposit-reminders schema validation failed: ${errors.join(", ")}`);

  const mapped = toLegacyBookingRow(sampleBookingCanonical);
  assert.equal(mapped.id, "EI-20261016-ABCD");
  assert.equal(mapped.member_phone, "0901 234 567");
  assert.equal(mapped.is_deposit, 1);
});

test("Consumer contract: Promotions & Categories match schema and map cleanly", () => {
  const samplePromotionCanonical = {
    id: "promo_test",
    categoryId: "cat_special",
    categoryName: "Special Events",
    categoryCode: "SPECIAL",
    categoryIcon: "star",
    categoryColor: "rose",
    name: "Sale 10%",
    code: "SALE10",
    description: "Discount 10%",
    discountType: "percentage",
    discountValue: 10,
    maxDiscountAmount: 50000,
    minOrderAmount: 200000,
    applicableRoomClasses: ["haven"],
    applicableBookingTypes: ["hourly"],
    applicableRatePlanCodes: ["combo3h"],
    applicableLoyaltyTiers: ["bronze"],
    applicableDaysOfWeek: [1, 2, 3, 4, 5],
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    usageLimit: 100,
    usedCount: 5,
    isActive: true,
    archivedAt: null,
    version: 2,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-05T00:00:00Z",
  };

  const samplePromoEnvelope = {
    promotion: samplePromotionCanonical,
  };

  const errors = bookingValidator.validateSchema("#/components/schemas/PromotionEnvelope", samplePromoEnvelope);
  assert.deepEqual(errors, [], `PromotionEnvelope schema validation failed: ${errors.join(", ")}`);

  const mappedPromo = toLegacyPromotion(samplePromotionCanonical);
  assert.equal(mappedPromo.id, "promo_test");
  assert.equal(mappedPromo.code, "SALE10");
  assert.equal(mappedPromo.discount_type, "percentage");
  assert.equal(mappedPromo.version, 2);

  const sampleCategoryCanonical = {
    id: "cat_special",
    name: "Special Events",
    code: "SPECIAL",
    description: "For holiday promotions",
    icon: "star",
    badgeColor: "rose",
    sortOrder: 1,
    isActive: true,
    version: 1,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };

  const sampleCatEnvelope = {
    category: sampleCategoryCanonical,
  };

  const catErrors = bookingValidator.validateSchema("#/components/schemas/CategoryEnvelope", sampleCatEnvelope);
  assert.deepEqual(catErrors, [], `CategoryEnvelope schema validation failed: ${catErrors.join(", ")}`);

  const mappedCat = toLegacyCategory(sampleCategoryCanonical);
  assert.equal(mappedCat.id, "cat_special");
  assert.equal(mappedCat.name, "Special Events");
  assert.equal(mappedCat.badge_color, "rose");
  assert.equal(mappedCat.version, 1);
});

test("Consumer contract: CDP Customer and Public Loyalty match schema", () => {
  const sampleAdminCustomer = {
    customerId: "cdp_cust_1",
    phone: "+84901234567",
    phoneNational: "0901234567",
    fullName: "Tran Thi B",
    instagram: "tranthib",
    facebook: "fb.com/tranthib",
    internalNotes: null,
    preferredRoomClass: "haven",
    isBlocked: false,
    marketingConsent: "unknown",
    loyalty: {
      tier: "bronze",
      tierRuleVersion: "mock-v1",
      lifetimeBookingCount: 3,
      nextTier: { code: "silver", remainingBookings: 2 },
      cancelledCount: 0,
      noShowCount: 0,
      firstCountedAt: "2026-09-01T00:00:00Z",
      lastCountedAt: "2026-10-15T00:00:00Z",
      stamp: {
        programCode: "everyinn-loyalty",
        cycleId: "cycle_1",
        status: "active",
        currentStep: 3,
        maxSteps: 10,
        startsAt: "2026-09-01T00:00:00Z",
        expiresAt: "2026-10-16T00:00:00Z",
        nextMilestoneStep: 8,
        milestones: [
          { step: 3, label: "Giảm 10%", status: "reached" },
          { step: 8, label: "Giảm 20%", status: "upcoming" },
        ],
      },
      rulesVersion: "mock-v1",
    },
    legacy: {
      totalSpent: 1000000,
      totalBookings: 3,
      loyaltyTier: "bronze",
      note: "",
    },
    reconciliationStatus: "ok",
    version: 1,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-10-15T00:00:00Z",
  };

  const sampleCustomerEnvelope = {
    customer: sampleAdminCustomer,
  };

  const errors = cdpValidator.validateSchema("#/components/schemas/CustomerEnvelope", sampleCustomerEnvelope);
  assert.deepEqual(errors, [], `CustomerEnvelope schema validation failed: ${errors.join(", ")}`);

  const mappedMember = toLegacyMemberResponse(sampleAdminCustomer);
  assert.equal(mappedMember.customerId, "cdp_cust_1");
  assert.equal(mappedMember.phone, "0901234567");
  assert.equal(mappedMember.fullName, "Tran Thi B");
  assert.equal(mappedMember.loyaltyTier, "bronze");
  assert.equal(mappedMember.totalBookings, 3);

  const samplePublicLoyalty = {
    found: true,
    phoneMasked: "09******67",
    tier: "bronze",
    lifetimeBookingCount: 3,
    nextTier: { code: "silver", remainingBookings: 2 },
    stamp: {
      status: "active",
      currentStep: 3,
      maxSteps: 10,
      startsAt: "2026-09-01T00:00:00Z",
      expiresAt: "2026-10-16T00:00:00Z",
      nextMilestoneStep: 8,
      milestones: [
        { step: 3, label: "Giảm 10%", status: "reached" },
        { step: 8, label: "Giảm 20%", status: "upcoming" },
      ],
    },
    rulesVersion: "mock-v1",
  };

  const publicErrors = cdpValidator.validateSchema("#/components/schemas/PublicLoyalty", samplePublicLoyalty);
  assert.deepEqual(publicErrors, [], `PublicLoyalty schema validation failed: ${publicErrors.join(", ")}`);
});
