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

-- ── ROOMS SEED ─────────────────────────────────
INSERT OR IGNORE INTO rooms (id, property_id, room_number, name, room_class, floor, area_sqm, max_guests, sort_order) VALUES
  ('haven-101', 'prop-01', '101', 'Haven 101', 'haven', 1, 22, 2, 1),
  ('haven-102', 'prop-01', '102', 'Haven 102', 'haven', 1, 22, 2, 2),
  ('sig-103',   'prop-01', '103', 'Signature 103', 'signature', 1, 28, 2, 3),

  ('haven-201', 'prop-01', '201', 'Haven 201', 'haven', 2, 22, 2, 4),
  ('haven-202', 'prop-01', '202', 'Haven 202', 'haven', 2, 22, 2, 5),
  ('sig-203',   'prop-01', '203', 'Signature 203', 'signature', 2, 28, 2, 6),

  ('haven-301', 'prop-01', '301', 'Haven 301', 'haven', 3, 22, 2, 7),
  ('haven-302', 'prop-01', '302', 'Haven 302', 'haven', 3, 22, 2, 8),
  ('sig-303',   'prop-01', '303', 'Signature 303', 'signature', 3, 28, 2, 9),

  ('haven-401', 'prop-01', '401', 'Haven 401', 'haven', 4, 22, 2, 10),
  ('haven-402', 'prop-01', '402', 'Haven 402', 'haven', 4, 22, 2, 11),
  ('sig-403',   'prop-01', '403', 'Signature 403', 'signature', 4, 28, 2, 12),

  ('haven-501', 'prop-01', '501', 'Haven 501', 'haven', 5, 22, 2, 13),
  ('haven-502', 'prop-01', '502', 'Haven 502', 'haven', 5, 22, 2, 14),
  ('sig-503',   'prop-01', '503', 'Signature 503', 'signature', 5, 28, 2, 15);

-- ── PRICING RULES ──────────────────────────────
INSERT OR IGNORE INTO pricing_rules (property_id, room_class, booking_type, base_price, extra_hour_fee) VALUES
  ('prop-01', 'haven', 'combo3h',   320000, 60000),
  ('prop-01', 'haven', 'combo6h',   450000, 60000),
  ('prop-01', 'haven', 'overnight', 500000, 60000),
  ('prop-01', 'haven', 'dayroom',   650000, 60000),

  ('prop-01', 'signature', 'combo3h',   370000, 60000),
  ('prop-01', 'signature', 'combo6h',   520000, 60000),
  ('prop-01', 'signature', 'overnight', 580000, 60000),
  ('prop-01', 'signature', 'dayroom',   750000, 60000);

-- ── SYSTEM CONFIGS ─────────────────────────────
INSERT OR IGNORE INTO configs (key, value, description) VALUES
  ('booking_rules', '{"min_hourly":3,"max_hourly_checkin":"21:00","overnight_start":"21:00","overnight_max_checkout":"12:00","day_checkin":"15:00","day_checkout":"12:00","max_late_checkout_hours":6,"extra_hour_fee":60000}', 'Quy tắc giờ đặt phòng và phụ phí'),
  ('cdp_tiers', '{"bronze":{"min_spent":500000,"min_bookings":1},"silver":{"min_spent":3000000,"min_bookings":5},"gold":{"min_spent":8000000,"min_bookings":10}}', 'Quy tắc thăng hạng thành viên');

-- ── INITIAL STAFF (Password: everyinn2024) ────
INSERT OR IGNORE INTO staff (phone, password_hash, full_name, role) VALUES
  ('0901234567', '$2b$10$e1V8rcJh6fVqCUWFVzQcE.sisvakU6SxdKhRgvu6KyaBtRMDIOvna', 'Quản lý Every Inn', 'manager'),
  ('0909998888', '$2b$10$e1V8rcJh6fVqCUWFVzQcE.sisvakU6SxdKhRgvu6KyaBtRMDIOvna', 'Lễ tân Ca sáng', 'receptionist');

-- ── SAMPLE CDP MEMBER ──────────────────────────
INSERT OR IGNORE INTO members (phone, full_name, total_bookings, total_spent, total_nights, loyalty_tier, preferred_room_class) VALUES
  ('0912345678', 'Nguyễn Văn An', 5, 3200000, 3, 'silver', 'haven'),
  ('0987654321', 'Trần Thị Bình', 1, 450000, 0, 'bronze', 'signature');
