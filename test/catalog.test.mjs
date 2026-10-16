import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher } from "../src/lib/cores.ts";
import { toLegacyRoom, toLegacyPricingRule } from "../src/lib/coreMappers.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const sampleCatalog = {
  property: { id: "every-inn-saigon", name: "Every Inn Saigon" },
  rooms: [
    {
      id: "room_haven_1",
      name: "Haven 1",
      roomNumber: "101",
      roomClass: "haven",
      floor: 1,
      doorCode: "1234",
      isActive: true,
      version: 1,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    },
  ],
  rateRules: [
    {
      id: "rate_haven_combo3h",
      roomClass: "haven",
      ratePlanCode: "combo3h",
      basePrice: 350000,
      extraHourFee: 50000,
      version: 1,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    },
  ],
  hourlyCheckinSlots: {
    slots: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    version: 1,
  },
  bookingRules: {
    min_hourly: 2,
    max_hourly_checkin: 21,
    overnight_start: 21,
    overnight_max_checkout: 12,
    day_checkin: 14,
    day_checkout: 12,
    max_late_checkout_hours: 4,
    extra_hour_fee: 50000,
    max_stay_hours: 24,
    require_social_account: true,
    version: 1,
  },
};

test("bookingCore.get fetches catalog and maps rooms cleanly", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/catalog", () => ({
    status: 200,
    headers: { etag: '"cat-v1"' },
    body: sampleCatalog,
  }));

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager" };
    const res = await bookingCore.get("/internal/v1/catalog", { staff });

    assert.equal(res.status, 200);
    const rooms = res.data.rooms.map((r) => toLegacyRoom(r, res.data.property.id));
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].id, "room_haven_1");
    assert.equal(rooms[0].name, "Haven 1");
    assert.equal(rooms[0].floor, 1);
    assert.equal(rooms[0].is_active, 1);
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.get maps pricing rules cleanly", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/catalog", () => ({
    status: 200,
    body: sampleCatalog,
  }));

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager" };
    const res = await bookingCore.get("/internal/v1/catalog", { staff });

    assert.equal(res.status, 200);
    const rules = res.data.rateRules.map(toLegacyPricingRule);
    assert.equal(rules.length, 1);
    assert.equal(rules[0].room_class, "haven");
    assert.equal(rules[0].booking_type, "combo3h");
    assert.equal(rules[0].base_price, 350000);
    assert.equal(rules[0].extra_hour_fee, 50000);
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.put updates config with expectedVersion", async () => {
  const fake = new FakeCore("booking");
  fake.on("PUT", "/internal/v1/configs/booking_rules", (req) => {
    assert.equal(req.body.expectedVersion, 1);
    return {
      status: 200,
      body: {
        config: {
          key: "booking_rules",
          value: { ...sampleCatalog.bookingRules, extra_hour_fee: 60000 },
          version: 2,
        },
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager" };
    const res = await bookingCore.put("/internal/v1/configs/booking_rules", {
      staff,
      body: {
        expectedVersion: 1,
        value: { extra_hour_fee: 60000 },
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.config.version, 2);
  } finally {
    setTestFetcher(null);
  }
});
