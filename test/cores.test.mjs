import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher, newIdempotencyKey, CoreError } from "../src/lib/cores.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

test("cores client propagates caller headers and idempotency key correctly", async () => {
  const fake = new FakeCore("booking");
  fake.on("POST", "/internal/v1/bookings", (_req) => {
    return {
      status: 201,
      body: {
        booking: { id: "bk-123", status: "confirmed" },
      },
    };
  });

  setTestFetcher((core) => {
    if (core === "booking") return fake;
    throw new Error("Unexpected core: " + core);
  });

  try {
    const staff = { id: 7, role: "manager", full_name: "Nguyễn Quản Lý" };
    const idemKey = newIdempotencyKey("booking-create");

    const res = await bookingCore.post("/internal/v1/bookings", {
      staff,
      idempotencyKey: idemKey,
      body: { roomId: 1, guestName: "Test Guest" },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.booking.id, "bk-123");

    assert.equal(fake.calls.length, 1);
    const lastCall = fake.calls[0];
    assert.equal(lastCall.headers.get("x-ei-caller"), "admin-bff");
    assert.equal(lastCall.headers.get("x-ei-actor-id"), "7");
    assert.equal(lastCall.headers.get("x-ei-actor-role"), "manager");
    assert.equal(lastCall.headers.get("idempotency-key"), idemKey);
    assert.equal(lastCall.body.guestName, "Test Guest");
  } finally {
    setTestFetcher(null);
  }
});

test("cores client parses 409 conflict and throws typed CoreError", async () => {
  const fake = new FakeCore("booking");
  fake.on("POST", "/internal/v1/bookings", () => {
    return {
      status: 409,
      body: {
        error: { code: "SLOT_CONFLICT", message: "Phòng đã có khách" },
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "receptionist", full_name: "Staff" };
    await assert.rejects(
      async () => {
        await bookingCore.post("/internal/v1/bookings", {
          staff,
          body: {},
        });
      },
      (err) => {
        assert.ok(err instanceof CoreError);
        assert.equal(err.status, 409);
        assert.equal(err.code, "SLOT_CONFLICT");
        assert.equal(err.message, "Phòng đã có khách");
        return true;
      }
    );
  } finally {
    setTestFetcher(null);
  }
});
