/**
 * Dev-only helper: print a bcrypt hash for a password so a staff account in `admin-db-dev`
 * can be given a known credential for end-to-end testing.
 *
 * Usage: node scripts/dev-password-hash.mjs '<password>'
 *
 * NEVER run this against the production database.
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/dev-password-hash.mjs '<password>'");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
console.log(hash);

