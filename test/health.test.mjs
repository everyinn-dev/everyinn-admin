import test from "node:test";
import assert from "node:assert/strict";
import { setTestFetcher } from "../src/lib/cores.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";
import { checkHealth } from "../src/lib/health.ts";

test("checkHealth returns 200/ok when all dependencies are healthy", async () => {
  const fakeBooking = new FakeCore("booking");
  fakeBooking.on("GET", "/health", () => ({ status: 200, body: { status: "ok" } }));

  const fakeCdp = new FakeCore("cdp");
  fakeCdp.on("GET", "/health", () => ({ status: 200, body: { status: "ok" } }));

  setTestFetcher((core) => {
    if (core === "booking") return fakeBooking;
    if (core === "cdp") return fakeCdp;
    throw new Error("Unknown core: " + core);
  });

  const mockDb = {
    prepare: () => ({
      first: async () => ({ "?": 1 }),
    }),
  };

  try {
    const report = await checkHealth({ db: mockDb });

    assert.equal(report.status, "ok");
    assert.equal(report.worker, "everyinn-admin");
    assert.equal(report.checks.adminDb, "ok");
    assert.equal(report.checks.bookingCore, "ok");
    assert.equal(report.checks.cdpCore, "ok");
  } finally {
    setTestFetcher(null);
  }
});

test("checkHealth returns degraded when a core dependency is down", async () => {
  const fakeBooking = new FakeCore("booking");
  fakeBooking.on("GET", "/health", () => ({ status: 503, body: { status: "down" } }));

  const fakeCdp = new FakeCore("cdp");
  fakeCdp.on("GET", "/health", () => ({ status: 200, body: { status: "ok" } }));

  setTestFetcher((core) => {
    if (core === "booking") return fakeBooking;
    if (core === "cdp") return fakeCdp;
    throw new Error("Unknown core: " + core);
  });

  try {
    const report = await checkHealth();

    assert.equal(report.status, "degraded");
    assert.equal(report.checks.bookingCore, "down");
    assert.equal(report.checks.cdpCore, "ok");
  } finally {
    setTestFetcher(null);
  }
});

test("checkHealth returns degraded when adminDb fails", async () => {
  const fakeBooking = new FakeCore("booking");
  fakeBooking.on("GET", "/health", () => ({ status: 200, body: { status: "ok" } }));

  const fakeCdp = new FakeCore("cdp");
  fakeCdp.on("GET", "/health", () => ({ status: 200, body: { status: "ok" } }));

  setTestFetcher((core) => {
    if (core === "booking") return fakeBooking;
    if (core === "cdp") return fakeCdp;
    throw new Error("Unknown core: " + core);
  });

  const brokenDb = {
    prepare: () => ({
      first: async () => {
        throw new Error("D1 connection lost");
      },
    }),
  };

  try {
    const report = await checkHealth({ db: brokenDb });

    assert.equal(report.status, "degraded");
    assert.equal(report.checks.adminDb, "down");
    assert.equal(report.checks.bookingCore, "ok");
    assert.equal(report.checks.cdpCore, "ok");
  } finally {
    setTestFetcher(null);
  }
});
