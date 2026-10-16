import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher, newIdempotencyKey } from "../src/lib/cores.ts";
import { toLegacyPromotion, toLegacyCategory } from "../src/lib/coreMappers.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const sampleCorePromo = {
  id: "PROMO-WELCOME10",
  categoryId: "cat_special",
  categoryName: "Ưu Đãi Kênh & Đối Tác",
  categoryCode: "special",
  categoryIcon: "🎁",
  categoryColor: "emerald",
  name: "Ưu Đãi Khách Mới 10%",
  code: "WELCOME10",
  description: "Giảm 10% cho khách đặt lần đầu",
  discountType: "percentage",
  discountValue: 10,
  maxDiscountAmount: 50000,
  minOrderAmount: 200000,
  applicableRoomClasses: ["haven", "signature"],
  applicableBookingTypes: ["hourly", "overnight"],
  applicableRatePlanCodes: ["combo3h", "combo6h", "overnight"],
  applicableLoyaltyTiers: ["not_member", "bronze"],
  applicableDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  usageLimit: 100,
  usedCount: 5,
  isActive: true,
  archivedAt: null,
  version: 2,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-05T12:00:00.000Z",
};

const sampleCoreCategory = {
  id: "cat_special",
  name: "Ưu Đãi Kênh & Đối Tác",
  code: "special",
  description: "Ưu đãi check-in, đánh giá mạng xã hội",
  icon: "🎁",
  badgeColor: "emerald",
  sortOrder: 1,
  isActive: true,
  version: 1,
  promoCount: 3,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

test("promotions mapping: converts Core promotion DTO to legacy snake_case format", () => {
  const mapped = toLegacyPromotion(sampleCorePromo);
  assert.equal(mapped.id, "PROMO-WELCOME10");
  assert.equal(mapped.category_id, "cat_special");
  assert.equal(mapped.category_name, "Ưu Đãi Kênh & Đối Tác");
  assert.equal(mapped.discount_type, "percentage");
  assert.equal(mapped.discount_value, 10);
  assert.equal(mapped.max_discount_amount, 50000);
  assert.equal(mapped.min_order_amount, 200000);
  assert.deepEqual(mapped.applicable_loyalty_tiers, ["new", "bronze"]); // not_member mapped to new
  assert.equal(mapped.is_active, 1);
  assert.equal(mapped.version, 2);
});

test("categories mapping: converts Core category DTO to legacy shape", () => {
  const mapped = toLegacyCategory(sampleCoreCategory);
  assert.equal(mapped.id, "cat_special");
  assert.equal(mapped.name, "Ưu Đãi Kênh & Đối Tác");
  assert.equal(mapped.code, "special");
  assert.equal(mapped.badge_color, "emerald");
  assert.equal(mapped.promo_count, 3);
  assert.equal(mapped.is_active, 1);
  assert.equal(mapped.version, 1);
});

test("bookingCore.get fetches promotions list with query filters", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/promotions", (req) => {
    assert.equal(req.url.searchParams.get("status"), "active");
    assert.equal(req.url.searchParams.get("categoryId"), "cat_special");
    return {
      status: 200,
      body: { promotions: [sampleCorePromo] },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.get("/internal/v1/promotions", {
      staff,
      query: { status: "active", categoryId: "cat_special" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.promotions.length, 1);
    const legacy = toLegacyPromotion(res.data.promotions[0]);
    assert.equal(legacy.name, "Ưu Đãi Khách Mới 10%");
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.post creates promotion with idempotency key and manager role", async () => {
  const fake = new FakeCore("booking");
  let capturedBody = null;
  let capturedKey = null;

  fake.on("POST", "/internal/v1/promotions", (req) => {
    capturedBody = req.body;
    capturedKey = req.headers.get("idempotency-key");
    return {
      status: 201,
      body: { promotion: { ...sampleCorePromo, id: "PROMO-NEW", version: 1 } },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager X" };
    const key = newIdempotencyKey("promo-create");
    const res = await bookingCore.post("/internal/v1/promotions", {
      staff,
      idempotencyKey: key,
      body: {
        name: "Test Promo",
        categoryId: "cat_special",
        discountType: "fixed_amount",
        discountValue: 30000,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.promotion.id, "PROMO-NEW");
    assert.equal(capturedKey, key);
    assert.equal(capturedBody.name, "Test Promo");
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.post validates promotion eligibility and calculates discount", async () => {
  const fake = new FakeCore("booking");
  fake.on("POST", "/internal/v1/promotions/validate", (req) => {
    assert.equal(req.body.promotionCode, "WELCOME10");
    assert.equal(req.body.rawSubtotal, 400000);
    return {
      status: 200,
      body: {
        valid: true,
        reasonCode: null,
        reason: null,
        discountAmount: 40000, // 10% of 400000 (under 50k cap)
        finalPrice: 360000,
        promotion: {
          id: "PROMO-WELCOME10",
          name: "Ưu Đãi Khách Mới 10%",
          code: "WELCOME10",
          discountType: "percentage",
          discountValue: 10,
          maxDiscountAmount: 50000,
          version: 2,
        },
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.post("/internal/v1/promotions/validate", {
      staff,
      body: {
        promotionCode: "WELCOME10",
        rawSubtotal: 400000,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.valid, true);
    assert.equal(res.data.discountAmount, 40000);
    assert.equal(res.data.finalPrice, 360000);
  } finally {
    setTestFetcher(null);
  }
});
