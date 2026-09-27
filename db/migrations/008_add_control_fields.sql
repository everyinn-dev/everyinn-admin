-- ── 008_add_control_fields.sql ─────────────────────
-- Standardize Control Fields across business tables (mod_no, updated_by_staff_id, etc.)
-- Cloudflare D1 (SQLite) Migration

-- 1. Bookings control fields
ALTER TABLE bookings ADD COLUMN mod_no INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE bookings ADD COLUMN updated_by_staff_id INTEGER;

-- 2. Members control fields
ALTER TABLE members ADD COLUMN mod_no INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE members ADD COLUMN created_by_staff_id INTEGER;
ALTER TABLE members ADD COLUMN updated_by_staff_id INTEGER;

-- 3. Room Blocks control fields
ALTER TABLE room_blocks ADD COLUMN mod_no INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE room_blocks ADD COLUMN updated_by INTEGER;
ALTER TABLE room_blocks ADD COLUMN updated_at TEXT;
