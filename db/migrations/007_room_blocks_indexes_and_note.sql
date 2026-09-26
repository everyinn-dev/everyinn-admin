-- ── 007_room_blocks_indexes_and_note.sql ─────────────────────
-- Add note column and high-performance date range indexes for room_blocks and bookings
-- Cloudflare D1 (SQLite) Migration

ALTER TABLE room_blocks ADD COLUMN note TEXT;

CREATE INDEX IF NOT EXISTS idx_room_blocks_room_date ON room_blocks(room_id, blocked_from, blocked_to);
CREATE INDEX IF NOT EXISTS idx_room_blocks_date ON room_blocks(blocked_from, blocked_to);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(checkin_at, checkout_at);
