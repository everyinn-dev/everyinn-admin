#!/usr/bin/env node
/**
 * Copy staff accounts from the legacy Admin D1 into a staff-only DB as INSERT statements (files only).
 *   npx wrangler d1 execute everyinn-admin --remote --json --command "SELECT id, phone, password_hash, full_name, role, is_active, last_login_at, created_at, updated_at FROM staff" > .backfill/staff-full.json
 *   node scripts/staff-copy.mjs .backfill/staff-full.json > .backfill/staff-copy.sql
 *   npx wrangler d1 execute admin-db-dev --remote --file .backfill/staff-copy.sql
 * Output contains password hashes — keep it in the git-ignored .backfill/ folder.
 */
import { readFileSync } from "node:fs";

const parsed = JSON.parse(readFileSync(process.argv[2], "utf8"));
const rows = Array.isArray(parsed) ? parsed.flatMap((r) => r.results ?? r) : parsed.results;
const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const cols = ["id", "phone", "password_hash", "full_name", "role", "is_active", "last_login_at", "created_at", "updated_at"];
for (const r of rows) {
  console.log(`INSERT OR IGNORE INTO staff (${cols.join(", ")}) VALUES (${cols.map((c) => q(r[c])).join(", ")});`);
}

