-- ── ADD HOURLY CHECKIN SLOTS CONFIG ──────────────────────────────
-- Allowed overnight check-in hours: 21h, 22h, 23h, 24h
INSERT OR REPLACE INTO configs (key, value, description) VALUES
  ('hourly_checkin_slots', '{"slots":[21,22,23,24]}', 'Khung giờ nhận phòng qua đêm được phép');
