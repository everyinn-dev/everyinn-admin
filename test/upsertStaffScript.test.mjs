import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { buildUpsertStaffSql, parseArgs, quoteSql } from "../scripts/upsert-staff.mjs";

test("quoteSql escapes single quotes and rejects null bytes", () => {
  assert.equal(quoteSql("O'Reilly"), "'O''Reilly'");
  assert.throws(() => quoteSql("bad\0input"), /Null bytes/);
});

test("buildUpsertStaffSql builds an idempotent staff upsert compatible with login verification", async () => {
  const hash = await bcrypt.hash("TestPass!2026", 4);
  const sql = buildUpsertStaffSql({
    phone: " 0909000001 ",
    passwordHash: hash,
    fullName: "Lễ tân Demo",
    role: "receptionist",
    isActive: true,
  });

  assert.match(sql, /INSERT INTO staff \(phone, password_hash, full_name, role, is_active, updated_at\)/);
  assert.match(sql, /VALUES \('0909000001', '\$2[aby]\$/);
  assert.match(sql, /'Lễ tân Demo', 'receptionist', 1, datetime\('now'\)\)/);
  assert.match(sql, /ON CONFLICT\(phone\) DO UPDATE SET/);
  assert.equal(await bcrypt.compare("TestPass!2026", hash), true);
});

test("buildUpsertStaffSql validates phone, role, name, and bcrypt hash", () => {
  const validHash = "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV";
  assert.throws(
    () => buildUpsertStaffSql({ phone: "abc", passwordHash: validHash, fullName: "Lễ tân Demo" }),
    /Invalid phone format/
  );
  assert.throws(
    () => buildUpsertStaffSql({ phone: "0909000001", passwordHash: validHash, fullName: "   " }),
    /fullName must not be empty/
  );
  assert.throws(
    () => buildUpsertStaffSql({ phone: "0909000001", passwordHash: validHash, fullName: "Lễ tân Demo", role: "admin" }),
    /Invalid role/
  );
  assert.throws(
    () => buildUpsertStaffSql({ phone: "0909000001", passwordHash: "plaintext", fullName: "Lễ tân Demo" }),
    /valid bcrypt hash/
  );
});

test("parseArgs parses CLI options cleanly", () => {
  const parsed = parseArgs([
    "--phone",
    "0909000001",
    "--name",
    "Lễ tân Demo",
    "--role",
    "manager",
    "--out",
    ".backfill/staff.sql",
    "--inactive",
  ]);
  assert.equal(parsed.phone, "0909000001");
  assert.equal(parsed.name, "Lễ tân Demo");
  assert.equal(parsed.role, "manager");
  assert.equal(parsed.outPath, ".backfill/staff.sql");
  assert.equal(parsed.isActive, false);
});
