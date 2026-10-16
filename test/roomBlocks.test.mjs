import test from "node:test";
import assert from "node:assert/strict";
import { bookingCore, setTestFetcher, newIdempotencyKey } from "../src/lib/cores.ts";
import { toLegacyRoomBlock } from "../src/lib/coreMappers.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

const sampleBlockDto = {
  id: "blk-101",
  roomId: "room_haven_1",
  roomName: "Haven 1",
  roomClass: "haven",
  blockedFrom: "2026-10-17T00:00:00Z",
  blockedTo: "2026-10-17T06:00:00Z",
  reason: "maintenance",
  note: "Sửa máy lạnh",
  status: "active",
  createdBy: { id: 1, name: "Manager" },
  createdAt: "2026-10-16T10:00:00Z",
  releasedAt: null,
  releasedBy: null,
  releaseReason: null,
  version: 1,
};

test("bookingCore.get fetches room blocks and maps to legacy format", async () => {
  const fake = new FakeCore("booking");
  fake.on("GET", "/internal/v1/room-blocks", (req) => {
    assert.equal(req.query.status, "active");
    return {
      status: 200,
      body: {
        blocks: [sampleBlockDto],
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager" };
    const res = await bookingCore.get("/internal/v1/room-blocks", {
      staff,
      query: { status: "active" },
    });

    assert.equal(res.status, 200);
    const legacyBlocks = res.data.blocks.map(toLegacyRoomBlock);
    assert.equal(legacyBlocks.length, 1);
    assert.equal(legacyBlocks[0].id, "blk-101");
    assert.equal(legacyBlocks[0].room_id, "room_haven_1");
    assert.equal(legacyBlocks[0].reason, "maintenance");
    assert.equal(legacyBlocks[0].version, 1);
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.post creates room block with idempotency key", async () => {
  const fake = new FakeCore("booking");
  fake.on("POST", "/internal/v1/room-blocks", (req) => {
    assert.ok(req.headers["idempotency-key"]);
    assert.equal(req.body.roomId, "room_haven_1");
    assert.equal(req.body.reason, "maintenance");
    return {
      status: 201,
      body: {
        block: sampleBlockDto,
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager" };
    const res = await bookingCore.post("/internal/v1/room-blocks", {
      staff,
      idempotencyKey: newIdempotencyKey("room-block-create"),
      body: {
        roomId: "room_haven_1",
        from: "2026-10-17T00:00:00Z",
        to: "2026-10-17T06:00:00Z",
        reason: "maintenance",
        note: "Sửa máy lạnh",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.block.id, "blk-101");
  } finally {
    setTestFetcher(null);
  }
});

test("bookingCore.post releases room block with expectedVersion", async () => {
  const fake = new FakeCore("booking");
  fake.on("POST", "/internal/v1/room-blocks/blk-101/release", (req) => {
    assert.equal(req.body.expectedVersion, 1);
    assert.equal(req.body.reason, "Sửa xong sớm");
    return {
      status: 200,
      body: {
        block: {
          ...sampleBlockDto,
          status: "released",
          releasedAt: "2026-10-16T12:00:00Z",
          version: 2,
        },
      },
    };
  });

  setTestFetcher(() => fake);

  try {
    const staff = { id: 1, role: "manager", full_name: "Manager" };
    const res = await bookingCore.post("/internal/v1/room-blocks/blk-101/release", {
      staff,
      idempotencyKey: newIdempotencyKey("room-block-release"),
      body: {
        expectedVersion: 1,
        reason: "Sửa xong sớm",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.block.status, "released");
    assert.equal(res.data.block.version, 2);
  } finally {
    setTestFetcher(null);
  }
});
