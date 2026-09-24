-- ── REFACTOR ROOMS & PRICING (6 ROOMS TOTAL) ─────────────────
-- Haven: 101, 201, 301 | Signature: 102, 202, 302

-- 1. Remove old rooms not part of the active 6 rooms
DELETE FROM rooms WHERE id NOT IN ('haven-101', 'haven-201', 'haven-301', 'sig-102', 'sig-202', 'sig-302');

-- 2. Upsert the 6 active rooms
INSERT OR REPLACE INTO rooms (id, property_id, room_number, name, room_class, floor, area_sqm, max_guests, sort_order, is_active) VALUES
  ('haven-101', 'prop-01', '101', 'Haven 101',     'haven',     1, 22, 2, 1, 1),
  ('sig-102',   'prop-01', '102', 'Signature 102', 'signature', 1, 28, 2, 2, 1),
  ('haven-201', 'prop-01', '201', 'Haven 201',     'haven',     2, 22, 2, 3, 1),
  ('sig-202',   'prop-01', '202', 'Signature 202', 'signature', 2, 28, 2, 4, 1),
  ('haven-301', 'prop-01', '301', 'Haven 301',     'haven',     3, 22, 2, 5, 1),
  ('sig-302',   'prop-01', '302', 'Signature 302', 'signature', 3, 28, 2, 6, 1);

-- 3. Refresh pricing rules to match the new rates
DELETE FROM pricing_rules WHERE id > 0;

INSERT INTO pricing_rules (id, property_id, room_class, booking_type, base_price, extra_hour_fee, is_active) VALUES
  (1, 'prop-01', 'haven',     'combo3h',   320000, 60000, 1),
  (2, 'prop-01', 'haven',     'combo6h',   600000, 60000, 1),
  (3, 'prop-01', 'haven',     'overnight', 490000, 60000, 1),
  (4, 'prop-01', 'haven',     'dayroom',   590000, 60000, 1),

  (5, 'prop-01', 'signature', 'combo3h',   360000, 60000, 1),
  (6, 'prop-01', 'signature', 'combo6h',   640000, 60000, 1),
  (7, 'prop-01', 'signature', 'overnight', 620000, 60000, 1),
  (8, 'prop-01', 'signature', 'dayroom',   750000, 60000, 1);

-- 4. Update booking rules config (overnight checkout 09:00, max late checkout 2h)
INSERT OR REPLACE INTO configs (key, value, description) VALUES
  ('booking_rules', '{"min_hourly":3,"max_hourly_checkin":"21:00","overnight_start":"21:00","overnight_max_checkout":"09:00","day_checkin":"15:00","day_checkout":"12:00","max_late_checkout_hours":2,"extra_hour_fee":60000}', 'Quy tắc giờ đặt phòng và phụ phí');
