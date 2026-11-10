import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createValidator } from "./helpers/schemaValidator.mjs";
import { AGENT_ROUTES } from "../src/lib/agentRoutes.ts";

const resolve = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const doc = JSON.parse(readFileSync(resolve("../contracts/agent-core.openapi.json"), "utf8"));
const v = createValidator(doc);

test("synced AdminApi contract: every proxied route exists in the provider contract", () => {
  assert.equal(doc.info.version, "agent-internal-v1");
  const ops = Object.entries(doc.paths).flatMap(([p, o]) =>
    Object.keys(o)
      .filter((m) => m !== "parameters")
      .map((m) => ({ method: m.toUpperCase(), path: p.replace(/^\/internal\/v1\//, "") })),
  );
  for (const r of AGENT_ROUTES) {
    const hit = ops.find(
      (o) =>
        o.method === r.method &&
        r.pattern.test(
          o.path.replace(/\{[A-Za-z]+\}/g, (m) => ({
            "{roomId}": "sig-102",
            "{collection}": "rules",
            "{guestId}": "conv:abc_123",
            "{runId}": "run_abcd-1234",
          })[m] ?? "abc_123"),
        ),
    );
    assert.ok(hit, `${r.method} ${r.pattern} is not in agent-core contract`);
  }
});

test("UI-consumed DTOs match the contract (settings, escalation, conversation, door-code audit)", () => {
  const settings = {
    botName: "Home",
    personaPrompt: "x".repeat(60),
    modelId: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    supervisedMode: true,
    busyUntil: null,
    quietHours: { enabled: true, start: "01:30", end: "07:15", holdBufferMinutes: 30 },
    busy: { active: false, reason: null, until: null },
    hotline: "0906 314 109",
    defaultHoldMinutes: 15,
    depositPercent: 50,
    depositMinLeadDays: 5,
    burstWaitSeconds: 60,
    takeoverMinutes: 120,
    autoCheckinWindowHours: 8,
    manualReminderLeadHours: 6,
    dailyNeuronBudget: 20000,
    toolSwitches: { ask_owner: true },
    version: 1,
  };
  assert.deepEqual(v.validateSchema("#/components/schemas/Settings", settings), []);

  const esc = {
    id: "esc_1",
    type: "CONFIRM_HOLD_PAYMENT",
    status: "pending",
    summary: "s",
    details: { payable: 1 },
    createdAt: "2026-11-03T00:00:00.000Z",
  };
  assert.deepEqual(v.validateSchema("#/components/schemas/Escalation", esc), []);

  const conv = {
    id: "c1",
    channel: "sandbox",
    senderName: "A",
    mode: "AI_ACTIVE",
    unreadCount: 0,
    pendingCount: 0,
    lastMessageAt: "2026-11-03T00:00:00.000Z",
    version: 1,
  };
  assert.deepEqual(v.validateSchema("#/components/schemas/Conversation", conv), []);

  const auditItem = {
    id: 1,
    action: "override_upsert",
    targetType: "booking_override",
    targetId: "EI-261110-101",
    source: "admin_ui",
    actorId: 3,
    actorRole: "manager",
    actorName: "Chủ Nhà",
    codeMasked: "•••0#",
    codeLength: 5,
    details: { note: "Khách check-in trễ" },
    requestId: "req-1",
    createdAt: "2026-11-10T03:00:00.000Z",
  };
  assert.deepEqual(v.validateSchema("#/components/schemas/DoorCodeAuditLog", auditItem), []);

  const bookingDoorCode = {
    bookingId: "EI-261110-101",
    resolved: { gate: { source: "vault", gateCodeId: "gc_1" }, lockbox: true, missing: [] },
    gateCode: "2580#",
    lockboxCode: "1234",
    overrideNote: null,
    gateMeta: {
      id: "gc_1",
      label: "Tuần 2 tháng 11",
      validFrom: "2026-11-09T17:00:00.000Z",
      validUntil: "2026-11-16T16:59:59.000Z",
    },
  };
  assert.deepEqual(v.validateSchema("#/components/schemas/BookingDoorCode", bookingDoorCode), []);
});

test("BFF allows every master-data collection the Vận hành AI screen loads", async () => {
  const { matchAgentRoute } = await import("../src/lib/agentRoutes.ts");
  for (const c of ["scenarios", "templates", "rules", "authority", "segments", "stay_shifts"]) {
    assert.ok(matchAgentRoute("GET", `md/${c}`), `GET md/${c}`);
    assert.ok(matchAgentRoute("PUT", `md/${c}/some-id`), `PUT md/${c}`);
  }
});
