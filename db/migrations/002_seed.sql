-- ── PROPERTY SEED ─────────────────────────────
INSERT OR IGNORE INTO properties (
  id, name, address, bank_id, bank_account, bank_holder_name, checkin_instruction, wifi_ssid, wifi_password
) VALUES (
  'prop-01',
  'Every Inn Vạn Hạnh',
  '397/24 Sư Vạn Hạnh, Phường 12, Quận 10, TP. Hồ Chí Minh',
  'MB',
  '987654321',
  'EVERY INN HOSPITALITY',
  'Lễ tân tầng G hoặc quét mã mở cửa',
  'EveryInn_Guest',
  'everyinn2024'
);

-- ── ROOMS SEED (3 Haven: 101, 201, 301 | 3 Signature: 102, 202, 302) ────────
INSERT OR IGNORE INTO rooms (id, property_id, room_number, name, room_class, floor, area_sqm, max_guests, sort_order) VALUES
  ('haven-101', 'prop-01', '101', 'Haven 101', 'haven', 1, 22, 2, 1),
  ('sig-102',   'prop-01', '102', 'Signature 102', 'signature', 1, 28, 2, 2),

  ('haven-201', 'prop-01', '201', 'Haven 201', 'haven', 2, 22, 2, 3),
  ('sig-202',   'prop-01', '202', 'Signature 202', 'signature', 2, 28, 2, 4),

  ('haven-301', 'prop-01', '301', 'Haven 301', 'haven', 3, 22, 2, 5),
  ('sig-302',   'prop-01', '302', 'Signature 302', 'signature', 3, 28, 2, 6);

-- ── PRICING RULES ──────────────────────────────
INSERT OR IGNORE INTO pricing_rules (property_id, room_class, booking_type, base_price, extra_hour_fee) VALUES
  ('prop-01', 'haven', 'combo3h',   320000, 60000),
  ('prop-01', 'haven', 'combo6h',   600000, 60000),
  ('prop-01', 'haven', 'overnight', 490000, 60000),
  ('prop-01', 'haven', 'dayroom',   590000, 60000),

  ('prop-01', 'signature', 'combo3h',   360000, 60000),
  ('prop-01', 'signature', 'combo6h',   640000, 60000),
  ('prop-01', 'signature', 'overnight', 620000, 60000),
  ('prop-01', 'signature', 'dayroom',   750000, 60000);

-- ── SYSTEM CONFIGS ─────────────────────────────
INSERT OR IGNORE INTO configs (key, value, description) VALUES
  ('booking_rules', '{"min_hourly":3,"max_hourly_checkin":"21:00","overnight_start":"21:00","overnight_max_checkout":"09:00","day_checkin":"15:00","day_checkout":"12:00","max_late_checkout_hours":2,"extra_hour_fee":60000}', 'Quy tắc giờ đặt phòng và phụ phí'),
  ('cdp_tiers', '{"bronze":{"min_spent":500000,"min_bookings":1},"silver":{"min_spent":3000000,"min_bookings":5},"gold":{"min_spent":8000000,"min_bookings":10}}', 'Quy tắc thăng hạng thành viên');

-- ── INITIAL STAFF (Password: everyinn2024) ────
INSERT OR IGNORE INTO staff (phone, password_hash, full_name, role) VALUES
  ('0901234567', '$2b$10$e1V8rcJh6fVqCUWFVzQcE.sisvakU6SxdKhRgvu6KyaBtRMDIOvna', 'Quản lý Every Inn', 'manager'),
  ('0909998888', '$2b$10$e1V8rcJh6fVqCUWFVzQcE.sisvakU6SxdKhRgvu6KyaBtRMDIOvna', 'Lễ tân Ca sáng', 'receptionist');

-- ── SAMPLE CDP MEMBER ──────────────────────────
INSERT OR IGNORE INTO members (phone, full_name, total_bookings, total_spent, total_nights, loyalty_tier, preferred_room_class) VALUES
  ('0912345678', 'Nguyễn Văn An', 5, 3200000, 3, 'silver', 'haven'),
  ('0987654321', 'Trần Thị Bình', 1, 450000, 0, 'bronze', 'signature');
