import test from "node:test";
import assert from "node:assert/strict";
import { agentCore, setTestFetcher } from "../src/lib/cores.ts";
import { matchAgentRoute } from "../src/lib/agentRoutes.ts";
import { FakeCore } from "./helpers/fakeCore.mjs";

test("agent proxy allow-list accepts door-code and AdminApi shapes and rejects everything else", () => {
  assert.ok(matchAgentRoute("GET", "settings"));
  assert.ok(matchAgentRoute("PUT", "settings"));
  assert.ok(matchAgentRoute("POST", "escalations/esc_123abc/resolve"));
  assert.ok(matchAgentRoute("GET", "door-codes"));
  assert.ok(matchAgentRoute("GET", "door-codes/audit"));
  assert.ok(matchAgentRoute("POST", "door-codes/gate"));
  assert.ok(matchAgentRoute("POST", "door-codes/resolve-batch"));
  assert.ok(matchAgentRoute("POST", "door-codes/gate/gc_123abc/deactivate"));
  assert.ok(matchAgentRoute("PUT", "door-codes/lockbox/sig-102"));
  assert.ok(matchAgentRoute("GET", "bookings/EI-261110-101/door-code"));
  assert.ok(matchAgentRoute("PUT", "bookings/EI-261110-101/door-code"));
  assert.ok(matchAgentRoute("DELETE", "bookings/EI-261110-101/door-code"));
  assert.equal(matchAgentRoute("POST", "sandbox/messages").timeoutMs, 28000);
  assert.equal(matchAgentRoute("DELETE", "settings"), null);
  assert.equal(matchAgentRoute("GET", "../internal/admin"), null);
  assert.equal(matchAgentRoute("POST", "holds/hld_1/confirm"), null); // Booking Core confirm is never proxied
  assert.equal(matchAgentRoute("PUT", "door-codes/lockbox/'; DROP TABLE"), null);
  assert.equal(matchAgentRoute("DELETE", "door-codes/audit"), null);
});

test("agentCore client sends admin-bff caller + staff actor and honours timeout options", async () => {
  const fake = new FakeCore("agent");
  fake.on("POST", "/internal/v1/escalations/esc_1/resolve", (req) => ({
    status: 200,
    body: { ok: true, bookingId: "EI-1", echo: req.body },
  }));
  setTestFetcher((core) => {
    if (core === "agent") return fake;
    throw new Error("unexpected core " + core);
  });
  try {
    const staff = { id: 3, role: "manager", full_name: "Chủ Nhà" };
    const res = await agentCore.post("/internal/v1/escalations/esc_1/resolve", {
      staff,
      body: { action: "confirm_deposit" },
      timeoutMs: 15000,
      maxAttempts: 1,
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.bookingId, "EI-1");
    const call = fake.calls[0];
    assert.equal(call.headers.get("x-ei-caller"), "admin-bff");
    assert.equal(call.headers.get("x-ei-actor-id"), "3");
    assert.equal(call.headers.get("x-ei-actor-role"), "manager");
    assert.equal(call.body.action, "confirm_deposit");
  } finally {
    setTestFetcher(null);
  }
});
