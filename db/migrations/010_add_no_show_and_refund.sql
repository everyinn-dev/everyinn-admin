-- ── 010_add_no_show_and_refund.sql ──────────────────────────
-- Add No-Show audit, refund tracking, and customer risk profiling
-- Cloudflare D1 (SQLite) Migration

-- 1. Bookings: Audit & Refund fields for No-Show
ALTER TABLE bookings ADD COLUMN no_show_at TEXT;
ALTER TABLE bookings ADD COLUMN no_show_by INTEGER;
ALTER TABLE bookings ADD COLUMN no_show_reason TEXT;
ALTER TABLE bookings ADD COLUMN refund_amount INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE bookings ADD COLUMN original_price INTEGER;

-- 2. Members (Mini CDP): Customer risk profiling (No-Show count)
ALTER TABLE members ADD COLUMN no_show_count INTEGER DEFAULT 0 NOT NULL;

-- 3. Optimization index for status-based queries
CREATE INDEX IF NOT EXISTS idx_bookings_status_checkin ON bookings(status, checkin_at);
