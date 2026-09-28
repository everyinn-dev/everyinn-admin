-- ── 011_promotions_and_categories.sql ──────────────────────────
-- Dynamic Promotion Categories & Promotions Management (Seasonal & Loyalty Tiers)
-- Cloudflare D1 (SQLite) Migration

-- 1. Table: promotion_categories (Danh mục loại ưu đãi)
CREATE TABLE IF NOT EXISTS promotion_categories (
  id          TEXT PRIMARY KEY,              -- 'cat_seasonal', 'cat_loyalty', 'cat_special'
  name        TEXT NOT NULL,                 -- 'Ưu Đãi Theo Mùa / Dịp Lễ', 'Ưu Đãi Hạng Thành Viên'
  code        TEXT UNIQUE NOT NULL,          -- 'seasonal', 'loyalty', 'special'
  description TEXT,
  icon        TEXT DEFAULT '🎁',             -- Emoji icon: 🍂, 👑, 🎁, ⚡
  badge_color TEXT DEFAULT 'purple',         -- 'purple', 'amber', 'emerald', 'sky', 'rose', 'indigo'
  sort_order  INTEGER DEFAULT 0,
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promo_categories_active ON promotion_categories(is_active, sort_order);

-- 2. Table: promotions (Danh mục chương trình ưu đãi)
CREATE TABLE IF NOT EXISTS promotions (
  id                       TEXT PRIMARY KEY,              -- 'PROMO-FALL-10', 'PROMO-GOLD-15'
  category_id              TEXT NOT NULL,
  name                     TEXT NOT NULL,                 -- 'Mùa Thu Vàng - Giảm 10%'
  code                     TEXT UNIQUE,                   -- 'THUVANG10', 'GOLD15' (uppercase)
  description              TEXT,

  -- Discount mechanism
  discount_type            TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' | 'fixed_amount'
  discount_value           INTEGER NOT NULL,              -- 10 (10%) hoặc 50000 (50.000 VNĐ)
  max_discount_amount      INTEGER DEFAULT NULL,          -- Giảm tối đa VNĐ khi giảm % (NULL = không giới hạn)

  -- Conditions & Target Audience
  min_order_amount         INTEGER DEFAULT 0,             -- Đơn tối thiểu (VNĐ)
  applicable_room_classes  TEXT DEFAULT '["haven","signature"]', -- JSON array
  applicable_booking_types TEXT DEFAULT '["hourly","overnight","dayuse","custom"]', -- JSON array
  applicable_loyalty_tiers TEXT DEFAULT '["new","bronze","silver","gold"]', -- JSON array
  applicable_days_of_week  TEXT DEFAULT '[0,1,2,3,4,5,6]', -- JSON array [0..6] (0=CN, 1=T2..), null=all

  -- Time Validity (Seasonal / Duration)
  start_date               TEXT DEFAULT NULL,             -- 'YYYY-MM-DD', NULL = vô thời hạn
  end_date                 TEXT DEFAULT NULL,             -- 'YYYY-MM-DD', NULL = vô thời hạn

  -- Usage & Limits
  usage_limit              INTEGER DEFAULT NULL,          -- Giới hạn tổng lượt dùng (NULL = không giới hạn)
  used_count               INTEGER DEFAULT 0,             -- Số lượt đã dùng

  -- Status & Control Fields
  is_active                INTEGER DEFAULT 1,
  created_by_staff_id      INTEGER,
  updated_by_staff_id      INTEGER,
  created_at               TEXT DEFAULT (datetime('now')),
  updated_at               TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES promotion_categories(id)
);

CREATE INDEX IF NOT EXISTS idx_promotions_category ON promotions(category_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);

-- 3. Audit & trace in bookings table
ALTER TABLE bookings ADD COLUMN promotion_id TEXT;
ALTER TABLE bookings ADD COLUMN promotion_code TEXT;

-- 4. Seed initial default Categories
INSERT OR IGNORE INTO promotion_categories (id, name, code, description, icon, badge_color, sort_order, is_active)
VALUES
  ('cat_seasonal', 'Ưu Đãi Theo Mùa / Dịp Lễ', 'seasonal', 'Các chương trình khuyến mãi theo mùa, kỳ nghỉ, dịp lễ hoặc chiến dịch marketing có thời hạn', '🍂', 'amber', 1, 1),
  ('cat_loyalty', 'Ưu Đãi Hạng Thành Viên', 'loyalty', 'Đặc quyền chiết khấu tự động cho khách hàng thân thiết Mini CDP (Bronze, Silver, Gold)', '👑', 'purple', 2, 1),
  ('cat_special', 'Ưu Đãi Kênh & Đối Tác', 'special', 'Ưu đãi check-in fanpage, đánh giá mạng xã hội, booking đặt sớm hoặc đối tác', '🎁', 'emerald', 3, 1);

-- 5. Seed initial promotions (Seasonal & Loyalty Tiers)
INSERT OR IGNORE INTO promotions (
  id, category_id, name, code, description, discount_type, discount_value, max_discount_amount,
  min_order_amount, applicable_room_classes, applicable_booking_types, applicable_loyalty_tiers,
  applicable_days_of_week, start_date, end_date, usage_limit, used_count, is_active
)
VALUES
  -- 🍂 Seasonal: Mùa Thu Vàng (Giảm 10% ngày thường T2 - T5)
  (
    'PROMO-SEASON-FALL',
    'cat_seasonal',
    'Mùa Thu Vàng - Giảm 10%',
    'THUVANG10',
    'Áp dụng ngày trong tuần từ Thứ Hai đến Thứ Năm cho mọi hạng phòng và hình thức đặt',
    'percentage',
    10,
    100000,
    250000,
    '["haven","signature"]',
    '["hourly","overnight","dayuse","custom"]',
    '["new","bronze","silver","gold"]',
    '[1,2,3,4]',
    '2026-09-01',
    '2026-11-30',
    200,
    0,
    1
  ),
  -- 🍂 Seasonal: Cuối Tuần Qua Đêm (Giảm 50.000đ)
  (
    'PROMO-SEASON-WEEKEND',
    'cat_seasonal',
    'Đêm Cuối Tuần - Giảm 50.000đ',
    'CUOITUAN50',
    'Khuyến mãi đêm Thứ Sáu & Thứ Bảy cho khách đặt phòng Qua Đêm',
    'fixed_amount',
    50000,
    NULL,
    450000,
    '["haven","signature"]',
    '["overnight"]',
    '["new","bronze","silver","gold"]',
    '[5,6]',
    '2026-09-01',
    '2026-12-31',
    150,
    0,
    1
  ),
  -- 👑 Loyalty: Thành viên Gold (Giảm 15% tối đa 150k)
  (
    'PROMO-LOYALTY-GOLD',
    'cat_loyalty',
    'Đặc Quyền Thành Viên Gold - Giảm 15%',
    'GOLDVIP15',
    'Đặc quyền riêng cho khách hàng đạt hạng Gold Mini CDP (≥10 đơn hoặc chi tiêu ≥8tr)',
    'percentage',
    15,
    150000,
    0,
    '["haven","signature"]',
    '["hourly","overnight","dayuse","custom"]',
    '["gold"]',
    '[0,1,2,3,4,5,6]',
    NULL,
    NULL,
    NULL,
    0,
    1
  ),
  -- 👑 Loyalty: Thành viên Silver (Giảm 10% tối đa 80k)
  (
    'PROMO-LOYALTY-SILVER',
    'cat_loyalty',
    'Đặc Quyền Thành Viên Silver - Giảm 10%',
    'SILVER10',
    'Dành cho khách hàng thân thiết đạt hạng Silver Mini CDP (≥5 đơn hoặc chi tiêu ≥3tr)',
    'percentage',
    10,
    80000,
    0,
    '["haven","signature"]',
    '["hourly","overnight","dayuse","custom"]',
    '["silver","gold"]',
    '[0,1,2,3,4,5,6]',
    NULL,
    NULL,
    NULL,
    0,
    1
  ),
  -- 👑 Loyalty: Thành viên Bronze (Giảm 30.000đ)
  (
    'PROMO-LOYALTY-BRONZE',
    'cat_loyalty',
    'Tri Ân Thành Viên Bronze - Giảm 30.000đ',
    'BRONZE30',
    'Dành cho khách hàng quay lại từ lần thứ 2 (Hạng Bronze Mini CDP)',
    'fixed_amount',
    30000,
    NULL,
    300000,
    '["haven","signature"]',
    '["hourly","overnight","dayuse","custom"]',
    '["bronze","silver","gold"]',
    '[0,1,2,3,4,5,6]',
    NULL,
    NULL,
    NULL,
    0,
    1
  ),
  -- 🎁 Special: Check-in MXH (Giảm 20.000đ)
  (
    'PROMO-SPECIAL-CHECKIN',
    'cat_special',
    'Check-in Instagram / Facebook - Giảm 20.000đ',
    'CHECKIN20K',
    'Áp dụng khi khách cung cấp tài khoản Instagram hoặc Facebook để check-in tại Every Inn',
    'fixed_amount',
    20000,
    NULL,
    250000,
    '["haven","signature"]',
    '["hourly","overnight","dayuse","custom"]',
    '["new","bronze","silver","gold"]',
    '[0,1,2,3,4,5,6]',
    NULL,
    NULL,
    500,
    0,
    1
  );
