-- ── 012_add_deposit_management.sql ──────────────────────────
-- Dynamic Deposit Tracking, Partial Payment & Automated Reminder Schedule
-- Cloudflare D1 (SQLite) Migration

-- 1. Thêm các cột quản lý đặt cọc vào bảng bookings
ALTER TABLE bookings ADD COLUMN is_deposit INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE bookings ADD COLUMN deposit_amount INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE bookings ADD COLUMN paid_amount INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE bookings ADD COLUMN remaining_amount INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE bookings ADD COLUMN deposit_due_date TEXT; -- 'YYYY-MM-DD'
ALTER TABLE bookings ADD COLUMN deposit_status TEXT DEFAULT 'none' NOT NULL; -- 'none' | 'deposit_paid' | 'fully_paid'

-- 2. Dấu thời gian Audit & nhân sự xử lý
ALTER TABLE bookings ADD COLUMN deposit_paid_at TEXT;
ALTER TABLE bookings ADD COLUMN deposit_reminder_sent_at TEXT;
ALTER TABLE bookings ADD COLUMN deposit_reminder_sent_by INTEGER;
ALTER TABLE bookings ADD COLUMN remaining_paid_at TEXT;
ALTER TABLE bookings ADD COLUMN remaining_paid_by INTEGER;

-- 3. Composite Index tối ưu triệt để D1 Rows Read Quota cho cơ chế Polling & Lọc danh sách
CREATE INDEX IF NOT EXISTS idx_bookings_deposit_due 
ON bookings(is_deposit, deposit_status, deposit_due_date);

CREATE INDEX IF NOT EXISTS idx_bookings_deposit_status 
ON bookings(deposit_status);
