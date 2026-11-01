import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher } from "../src/lib/cores.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const sampleRevenueMatrix = {
  from: "2026-07",
  to: "2026-10",
  months: ["2026-07", "2026-08", "2026-09", "2026-10"],
  basis: "checkin_at",
  status: "confirmed",
  rooms: [
    { roomId: "haven-101", roomNumber: "101", roomClass: "haven", floor: 1, values: [320000, 640000, 0, 960000], total: 1920000 },
    { roomId: "sig-102", roomNumber: "102", roomClass: "signature", floor: 1, values: [0, 400000, 800000, 0], total: 1200000 },
  ],
  columnTotals: [320000, 1040000, 800000, 960000],
  grandTotal: 3120000,
  bookingCount: 8,
};

test("bookingCore fetches revenue matrix correctly", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/finance/revenue-matrix", (req) => {
    assert.equal(req.url.searchParams.get("from"), "2026-07");
    assert.equal(req.url.searchParams.get("to"), "2026-10");
    return {
      status: 200,
      headers: { etag: 'W/"bk-revenue-123"' },
      body: sampleRevenueMatrix,
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.get("/internal/v1/finance/revenue-matrix", {
      staff,
      query: { from: "2026-07", to: "2026-10" },
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.data, sampleRevenueMatrix);
    assert.equal(res.etag, 'W/"bk-revenue-123"');
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore revenue matrix handles ETag 304 Not Modified", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/finance/revenue-matrix", (req) => {
    if (req.headers.get("if-none-match") === 'W/"bk-revenue-123"') {
      return {
        status: 304,
        headers: { etag: 'W/"bk-revenue-123"' },
      };
    }
    return {
      status: 200,
      headers: { etag: 'W/"bk-revenue-123"' },
      body: sampleRevenueMatrix,
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff A" };
    const res = await bookingCore.get("/internal/v1/finance/revenue-matrix", {
      staff,
      query: { from: "2026-07", to: "2026-10" },
      ifNoneMatch: 'W/"bk-revenue-123"',
    });

    assert.equal(res.status, 304);
    assert.equal(res.data, null);
  } finally {
    setTestFetcher(null);
  }
});
