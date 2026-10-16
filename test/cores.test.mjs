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
    // Conflict should never be retried
    assert.equal(fake.calls.length, 1);
  } finally {
    setTestFetcher(null);
  }
});

test("cores client retries GET on 503 and succeeds on 2nd attempt", async () => {
  const fake = new FakeCore("booking");
  let callCount = 0;
  fake.on("GET", "/internal/v1/rooms", () => {
    callCount++;
    if (callCount === 1) {
      return {
        status: 503,
        body: { error: { code: "TEMP_BUSY", message: "Server busy" } },
      };
    }
    return {
      status: 200,
      body: { rooms: [{ id: 1, name: "Room 101" }] },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff" };
    const res = await bookingCore.get("/internal/v1/rooms", { staff });

    assert.equal(res.status, 200);
    assert.equal(callCount, 2);
    assert.equal(fake.calls.length, 2);
  } finally {
    setTestFetcher(null);
  }
});

test("cores client retries idempotent POST on network failure and succeeds", async () => {
  let callCount = 0;
  const mockFetcher = {
    async fetch(_url, _init) {
      callCount++;
      if (callCount === 1) {
        throw new Error("Simulated connection reset");
      }
      return new Response(JSON.stringify({ booking: { id: "bk-retry" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  };

  setTestFetcher(() => mockFetcher);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff" };
    const idemKey = newIdempotencyKey("booking-retry");
    const res = await bookingCore.post("/internal/v1/bookings", {
      staff,
      idempotencyKey: idemKey,
      body: { roomId: 1 },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.booking.id, "bk-retry");
    assert.equal(callCount, 2);
  } finally {
    setTestFetcher(null);
  }
});

test("cores client does NOT retry non-idempotent POST without idempotencyKey on 503", async () => {
  let callCount = 0;
  const mockFetcher = {
    async fetch() {
      callCount++;
      return new Response(JSON.stringify({ error: { code: "CORE_DOWN", message: "Unavailable" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    },
  };

  setTestFetcher(() => mockFetcher);

  try {
    const staff = { id: 1, role: "manager", full_name: "Staff" };
    await assert.rejects(
      async () => {
        await bookingCore.post("/internal/v1/bookings", {
          staff,
          body: { amount: 100 },
          // No idempotencyKey provided
        });
      },
      (err) => {
        assert.ok(err instanceof CoreError);
        assert.equal(err.status, 503);
        return true;
      }
    );

    // Because it's not idempotent, it must NOT retry!
    assert.equal(callCount, 1);
  } finally {
    setTestFetcher(null);
  }
});

