import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysYmd,
  buildDoorCodeAuditDescriptor,
  chunkArray,
  findGateCodesForVnDate,
  formatBookingDoorCodeCopyText,
  isManagerOnlyDoorCodeRoute,
  isReceptionistAllowedAgentRoute,
  maskDoorCode,
  normalizeDoorCode,
  vnDateRangeToIso,
} from "../src/lib/doorCodeUtils.ts";

test("normalizeDoorCode and maskDoorCode handle valid/invalid PINs cleanly", () => {
  assert.equal(normalizeDoorCode(" 2580# "), "2580#");
  assert.equal(normalizeDoorCode("*123456#"), "*123456#");
  assert.equal(normalizeDoorCode("12"), null);
  assert.equal(normalizeDoorCode("1234abcd"), null);

  assert.equal(maskDoorCode("2580#"), "•••0#");
  assert.equal(maskDoorCode("123"), "••23");
  assert.equal(maskDoorCode("12"), "••");
  assert.equal(maskDoorCode(""), null);
  assert.equal(maskDoorCode(null), null);
});

test("vnDateRangeToIso converts +07:00 Vietnam dates accurately across UTC midnight", () => {
  const range = vnDateRangeToIso("2026-11-10", "2026-11-12");
  assert.ok(range);
  assert.equal(range.validFrom, "2026-11-09T17:00:00.000Z"); // 2026-11-10 00:00 +07:00
  assert.equal(range.validUntil, "2026-11-12T16:59:59.000Z"); // 2026-11-12 23:59:59 +07:00

  assert.equal(vnDateRangeToIso("2026-11-12", "2026-11-10"), null);
  assert.equal(addDaysYmd("2026-11-30", 1), "2026-12-01");
});

test("findGateCodesForVnDate matches overlapping non-inactive passes newest-first", () => {
  const gates = [
    {
      id: "old",
      code: "1111#",
      label: "Old",
      validFrom: "2026-11-09T17:00:00.000Z",
      validUntil: "2026-11-11T16:59:59.000Z",
      state: "current",
      source: "admin_ui",
    },
    {
      id: "newer",
      code: "2222#",
      label: "Newer",
      validFrom: "2026-11-10T01:00:00.000Z",
      validUntil: null,
      state: "scheduled",
      source: "admin_ui",
    },
    {
      id: "inactive-one",
      code: "9999#",
      label: "Disabled",
      validFrom: "2026-11-09T17:00:00.000Z",
      validUntil: null,
      state: "inactive",
      source: "admin_ui",
    },
  ];
  const matched = findGateCodesForVnDate(gates, "2026-11-10");
  assert.deepEqual(matched.map((g) => g.id), ["newer", "old"]);
  assert.equal(findGateCodesForVnDate(gates, "2026-11-08").length, 0);
});

test("chunkArray and formatBookingDoorCodeCopyText work cleanly", () => {
  assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(
    formatBookingDoorCodeCopyText({ roomNumber: "101", gateCode: "2580#", lockboxCode: "9901" }),
    "Phòng 101 | Mã cổng: 2580# | Hộp khóa: 9901",
  );
  assert.equal(
    formatBookingDoorCodeCopyText({ roomNumber: "202", gateCode: "2580#", lockboxCode: null }),
    "Phòng 202 | Mã cổng: 2580#",
  );
});

test("isManagerOnlyDoorCodeRoute allows receptionist reads and blocks writes & audit reads", () => {
  // Read & batch resolve allowed for receptionist
  assert.equal(isManagerOnlyDoorCodeRoute("GET", "door-codes"), false);
  assert.equal(isManagerOnlyDoorCodeRoute("GET", "bookings/EI-100/door-code"), false);
  assert.equal(isManagerOnlyDoorCodeRoute("POST", "door-codes/resolve-batch"), false);

  // Writes & audit blocked for receptionist
  assert.equal(isManagerOnlyDoorCodeRoute("POST", "door-codes/gate"), true);
  assert.equal(isManagerOnlyDoorCodeRoute("POST", "door-codes/gate/gc_1/deactivate"), true);
  assert.equal(isManagerOnlyDoorCodeRoute("PUT", "door-codes/lockbox/haven-101"), true);
  assert.equal(isManagerOnlyDoorCodeRoute("PUT", "bookings/EI-100/door-code"), true);
  assert.equal(isManagerOnlyDoorCodeRoute("DELETE", "bookings/EI-100/door-code"), true);
  assert.equal(isManagerOnlyDoorCodeRoute("GET", "door-codes/audit"), true);

  // Full /api/agent/* boundary for receptionist: ONLY door-code read/resolve allowed
  assert.equal(isReceptionistAllowedAgentRoute("GET", "door-codes"), true);
  assert.equal(isReceptionistAllowedAgentRoute("GET", "bookings/EI-100/door-code"), true);
  assert.equal(isReceptionistAllowedAgentRoute("POST", "door-codes/resolve-batch"), true);
  assert.equal(isReceptionistAllowedAgentRoute("GET", "settings"), false);
  assert.equal(isReceptionistAllowedAgentRoute("PUT", "settings"), false);
  assert.equal(isReceptionistAllowedAgentRoute("GET", "conversations"), false);
  assert.equal(isReceptionistAllowedAgentRoute("GET", "runs"), false);
  assert.equal(isReceptionistAllowedAgentRoute("GET", "md/rules"), false);
  assert.equal(isReceptionistAllowedAgentRoute("POST", "door-codes/gate"), false);
  assert.equal(isReceptionistAllowedAgentRoute("GET", "door-codes/audit"), false);
});

test("buildDoorCodeAuditDescriptor logs secret-safe masked audit entries and never stores plaintext PINs", () => {
  const manager = { id: 1, role: "manager", full_name: "Chủ Nhà" };
  const receptionist = { id: 4, role: "receptionist", full_name: "Mi An" };

  const gateAudit = buildDoorCodeAuditDescriptor({
    method: "POST",
    path: "door-codes/gate",
    status: 201,
    body: { code: "2580#", label: "Tháng 11" },
    responseData: { gateCode: { id: "gc_99", validFrom: "2026-11-09T17:00:00.000Z", validUntil: null }, releasedSchedules: 2 },
    staff: manager,
  });
  assert.equal(gateAudit?.eventType, "door_code.gate_create");
  assert.equal(gateAudit?.entityId, "gc_99");
  assert.equal(gateAudit?.payload.codeMasked, "•••0#");
  assert.equal(gateAudit?.payload.codeLength, 5);
  assert.ok(!JSON.stringify(gateAudit).includes("2580#"));

  const overrideAudit = buildDoorCodeAuditDescriptor({
    method: "PUT",
    path: "bookings/EI-261110-101/door-code",
    status: 200,
    body: { gateCode: "9988*", note: "Đổi mã riêng khách VIP" },
    responseData: { releasedSchedules: 1 },
    staff: manager,
  });
  assert.equal(overrideAudit?.eventType, "door_code.override_upsert");
  assert.equal(overrideAudit?.payload.codeMasked, "•••8*");
  assert.equal(overrideAudit?.payload.note, "Đổi mã riêng khách VIP");
  assert.ok(!JSON.stringify(overrideAudit).includes("9988*"));

  const lockboxAudit = buildDoorCodeAuditDescriptor({
    method: "PUT",
    path: "door-codes/lockbox/haven-101",
    status: 200,
    body: { code: "4567" },
    responseData: { releasedSchedules: 0 },
    staff: manager,
  });
  assert.equal(lockboxAudit?.eventType, "door_code.lockbox_upsert");
  assert.equal(lockboxAudit?.entityId, "haven-101");
  assert.equal(lockboxAudit?.payload.codeMasked, "••67");
  assert.ok(!JSON.stringify(lockboxAudit).includes("4567"));

  const deniedAudit = buildDoorCodeAuditDescriptor({
    method: "PUT",
    path: "bookings/EI-261110-101/door-code",
    status: 403,
    body: { gateCode: "7777#" },
    staff: receptionist,
  });
  assert.equal(deniedAudit?.eventType, "door_code.access_denied");
  assert.equal(deniedAudit?.payload.role, "receptionist");
  assert.ok(!JSON.stringify(deniedAudit).includes("7777#"));
});
