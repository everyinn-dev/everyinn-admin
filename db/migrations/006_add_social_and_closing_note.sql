-- ── 006_add_social_and_closing_note.sql ─────────────────────
-- Add instagram and facebook to members (Mini CDP)
-- Add instagram, facebook, and closing_note to bookings
-- Cloudflare D1 (SQLite) Migration

ALTER TABLE members ADD COLUMN instagram TEXT;
ALTER TABLE members ADD COLUMN facebook TEXT;

ALTER TABLE bookings ADD COLUMN instagram TEXT;
ALTER TABLE bookings ADD COLUMN facebook TEXT;
ALTER TABLE bookings ADD COLUMN closing_note TEXT;
