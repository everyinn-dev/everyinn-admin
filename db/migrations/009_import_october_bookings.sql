-- ── 009_import_october_bookings.sql ──────────────────────────
-- Import 10 October 2026 bookings from operational Excel tracker into Every Inn Admin D1 Database
-- Generated for Cloudflare D1 (SQLite) with full schema compliance (Control Fields + Mini CDP)

-- ============================================================================
-- 1. UPSERT MEMBERS (Mini CDP)
-- ============================================================================

-- 1. phvijjw (0904306341)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0904306341',
  'phvijjw',
  'phvijjw',
  NULL,
  1,
  531000,
  1,
  '2026-10-02T08:00:00.000Z',
  '2026-10-02T08:00:00.000Z',
  'bronze',
  'haven',
  'IG: phvijjw | Chốt: Dạ vậy home xác nhận checkin 2 người từ 15h. Giá đặt sớm giảm 10% là 531.000 ạ',
  0,
  0,
  0,
  1,
  '2026-09-27T05:00:00.000Z',
  '2026-09-27T05:00:00.000Z'
);

-- 2. Anh Duc Vu (0918841638)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0918841638',
  'Anh Duc Vu',
  NULL,
  'Anh Duc Vu',
  1,
  685000,
  2,
  '2026-10-02T15:00:00.000Z',
  '2026-10-02T15:00:00.000Z',
  'bronze',
  'signature',
  'FB: Anh Duc Vu | Đã cọc 50%',
  0,
  0,
  0,
  1,
  '2026-09-12T05:00:00.000Z',
  '2026-09-12T05:00:00.000Z'
);

-- 3. Thaotica (0377863799)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0377863799',
  'Thaotica',
  'Thaotica',
  NULL,
  1,
  440000,
  0,
  '2026-10-02T17:00:00.000Z',
  '2026-10-02T17:00:00.000Z',
  'new',
  'haven',
  'IG: Thaotica | Giảm 50k gói qua đêm',
  0,
  0,
  0,
  1,
  '2026-09-09T05:00:00.000Z',
  '2026-09-09T05:00:00.000Z'
);

-- 4. Thy tr (0911571514)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0911571514',
  'Thy tr',
  NULL,
  'Thy tr',
  1,
  1349000,
  2,
  '2026-10-03T11:00:00.000Z',
  '2026-10-03T11:00:00.000Z',
  'bronze',
  'signature',
  'FB: Thy tr | Cọc 50% (Tổng 1.349.000đ)',
  0,
  0,
  0,
  1,
  '2026-09-22T05:00:00.000Z',
  '2026-09-22T05:00:00.000Z'
);

-- 5. khangtrainer (0916410148)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0916410148',
  'khangtrainer',
  'khangtrainer',
  NULL,
  1,
  1416000,
  3,
  '2026-10-05T08:00:00.000Z',
  '2026-10-05T08:00:00.000Z',
  'bronze',
  'haven',
  'IG: khangtrainer | 3 đêm Haven 101',
  0,
  0,
  0,
  1,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

-- 6. ngocnhicz (0348451106)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0348451106',
  'ngocnhicz',
  'ngocnhicz',
  NULL,
  1,
  950000,
  1,
  '2026-10-14T07:00:00.000Z',
  '2026-10-14T07:00:00.000Z',
  'bronze',
  'signature',
  'IG: ngocnhicz | Phụ thu late checkout đến 19h',
  0,
  0,
  0,
  1,
  '2026-09-25T05:00:00.000Z',
  '2026-09-25T05:00:00.000Z'
);

-- 7. Quỳnh Anh (0979027234)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0979027234',
  'Quỳnh Anh',
  'quynhanhh___',
  NULL,
  1,
  2700000,
  4,
  '2026-10-15T06:00:00.000Z',
  '2026-10-15T06:00:00.000Z',
  'bronze',
  'signature',
  'IG: quynhanhh___ | 4 đêm Signature 102. Tổng 2.700.000đ (đã giảm 10%), đã cọc 50% 1.350.000đ',
  0,
  0,
  0,
  1,
  '2026-09-14T05:00:00.000Z',
  '2026-09-14T05:00:00.000Z'
);

-- 8. ryiihope (0342923037)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0342923037',
  'ryiihope',
  'ryiihope',
  NULL,
  1,
  590000,
  1,
  '2026-10-17T08:00:00.000Z',
  '2026-10-17T08:00:00.000Z',
  'bronze',
  'haven',
  'IG: ryiihope | Haven 301',
  0,
  0,
  0,
  1,
  '2026-09-08T05:00:00.000Z',
  '2026-09-08T05:00:00.000Z'
);

-- 9. Linh Đoan (0989937518)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0989937518',
  'Linh Đoan',
  NULL,
  'Linh Đoan',
  1,
  1150000,
  4,
  '2026-10-17T15:00:00.000Z',
  '2026-10-17T15:00:00.000Z',
  'bronze',
  'signature',
  'FB: Linh Đoan | Sale 4 đêm Signature 202, đã cọc 50% (1.150.000đ)',
  0,
  0,
  0,
  1,
  '2026-09-11T05:00:00.000Z',
  '2026-09-11T05:00:00.000Z'
);

-- 10. Becaaaaaaa (0866866904)
INSERT OR REPLACE INTO members (
  phone, full_name, instagram, facebook, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, mod_no, created_by_staff_id, created_at, updated_at
) VALUES (
  '0866866904',
  'Becaaaaaaa',
  'Becaaaaaaa',
  NULL,
  1,
  776000,
  3,
  '2026-10-23T08:00:00.000Z',
  '2026-10-23T08:00:00.000Z',
  'bronze',
  'haven',
  'IG: Becaaaaaaa | Haven 301 3 đêm, đã cọc',
  0,
  0,
  0,
  1,
  '2026-09-13T05:00:00.000Z',
  '2026-09-13T05:00:00.000Z'
);

-- ============================================================================
-- 2. INSERT BOOKINGS
-- ============================================================================

-- Booking 1: phvijjw (Haven 201)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261002-20101',
  'prop-01',
  'haven-201',
  '0904306341',
  'phvijjw',
  'phvijjw',
  NULL,
  2,
  'dayuse',
  '2026-10-02T08:00:00.000Z',
  '2026-10-03T08:00:00.000Z',
  0,
  'IG: phvijjw',
  'Dạ vậy home xác nhận checkin 2 người từ 15h. Giá đặt sớm giảm 10% là 531.000 ạ',
  'confirmed',
  590000,
  0,
  59000,
  531000,
  1,
  0,
  '2026-09-27T05:00:00.000Z',
  '2026-09-27T05:00:00.000Z'
);

-- Booking 2: Anh Duc Vu (Signature 102)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261002-10202',
  'prop-01',
  'sig-102',
  '0918841638',
  'Anh Duc Vu',
  NULL,
  'Anh Duc Vu',
  2,
  'dayuse',
  '2026-10-02T15:00:00.000Z',
  '2026-10-04T05:00:00.000Z',
  0,
  'FB: Anh Duc Vu | Đã cọc 50%',
  'Dạ vậy bên Home xin chốt là bên mình book',
  'confirmed',
  685000,
  0,
  0,
  685000,
  1,
  0,
  '2026-09-12T05:00:00.000Z',
  '2026-09-12T05:00:00.000Z'
);

-- Booking 3: Thaotica (Haven 101)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261003-10103',
  'prop-01',
  'haven-101',
  '0377863799',
  'Thaotica',
  'Thaotica',
  NULL,
  2,
  'overnight',
  '2026-10-02T17:00:00.000Z',
  '2026-10-03T05:00:00.000Z',
  0,
  'IG: Thaotica | Giảm 50k',
  'vậy mình cho cho bạn check in ngày 3/10 lúc',
  'confirmed',
  490000,
  0,
  50000,
  440000,
  1,
  0,
  '2026-09-09T05:00:00.000Z',
  '2026-09-09T05:00:00.000Z'
);

-- Booking 4: Thy tr (Signature 202)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261003-20204',
  'prop-01',
  'sig-202',
  '0911571514',
  'Thy tr',
  NULL,
  'Thy tr',
  2,
  'dayuse',
  '2026-10-03T11:00:00.000Z',
  '2026-10-05T05:00:00.000Z',
  0,
  'FB: Thy tr | Cọc 50%',
  'Dạa vậy home xác nhận checkin 18h ngày 03. 1tr349 ạ',
  'confirmed',
  1500000,
  0,
  151000,
  1349000,
  1,
  0,
  '2026-09-22T05:00:00.000Z',
  '2026-09-22T05:00:00.000Z'
);

-- Booking 5: khangtrainer (Haven 101)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261005-10105',
  'prop-01',
  'haven-101',
  '0916410148',
  'khangtrainer',
  'khangtrainer',
  NULL,
  2,
  'dayuse',
  '2026-10-05T08:00:00.000Z',
  '2026-10-08T05:00:00.000Z',
  0,
  'IG: khangtrainer',
  'Dạ vậy home xác nhận checkin 2 người từ 15h',
  'confirmed',
  1770000,
  0,
  354000,
  1416000,
  1,
  0,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

-- Booking 6: ngocnhicz (Signature 202)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261014-20206',
  'prop-01',
  'sig-202',
  '0348451106',
  'ngocnhicz',
  'ngocnhicz',
  NULL,
  2,
  'dayuse',
  '2026-10-14T07:00:00.000Z',
  '2026-10-15T12:00:00.000Z',
  7,
  'IG: ngocnhicz | Phụ thu late checkout đến 19h (+200k)',
  'Dạ vâng vậy bên Home xin chốt là bên mình',
  'confirmed',
  750000,
  200000,
  0,
  950000,
  1,
  0,
  '2026-09-25T05:00:00.000Z',
  '2026-09-25T05:00:00.000Z'
);

-- Booking 7: Quỳnh Anh (Signature 102)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261015-10207',
  'prop-01',
  'sig-102',
  '0979027234',
  'Quỳnh Anh',
  'quynhanhh___',
  NULL,
  2,
  'dayuse',
  '2026-10-15T06:00:00.000Z',
  '2026-10-19T01:00:00.000Z',
  0,
  'IG: quynhanhh___ | 4 đêm Sig 102. Tổng 2.700.000đ (đã giảm 10%), đã cọc 50% 1.350.000đ, còn lại thu khi check-in 1.350.000đ',
  'Dạ home xác nhận checkin 2 người từ 13h n. Giá 3.000.000 cho 4 đêm, được giảm 10% ưu đãi. Còn lại tổng là 2tr700 ạ',
  'confirmed',
  3000000,
  0,
  300000,
  2700000,
  1,
  0,
  '2026-09-14T05:00:00.000Z',
  '2026-09-14T05:00:00.000Z'
);

-- Booking 8: ryiihope (Haven 301)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261017-30108',
  'prop-01',
  'haven-301',
  '0342923037',
  'ryiihope',
  'ryiihope',
  NULL,
  2,
  'dayuse',
  '2026-10-17T08:00:00.000Z',
  '2026-10-18T05:00:00.000Z',
  0,
  'IG: ryiihope',
  'Vậy bên Home xin chốt là bên mình book 301',
  'confirmed',
  590000,
  0,
  0,
  590000,
  1,
  0,
  '2026-09-08T05:00:00.000Z',
  '2026-09-08T05:00:00.000Z'
);

-- Booking 9: Linh Đoan (Signature 202)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261017-20209',
  'prop-01',
  'sig-202',
  '0989937518',
  'Linh Đoan',
  NULL,
  'Linh Đoan',
  2,
  'dayuse',
  '2026-10-17T15:00:00.000Z',
  '2026-10-21T05:00:00.000Z',
  0,
  'FB: Linh Đoan | Sale cọc 50% (Đã cọc 1.150.000đ)',
  'Dạ vậy home xin xác nhận checkin từ 22h. Tổng áp dụng ưu đãi hiện tại cho bạn luôn ạ',
  'confirmed',
  1150000,
  0,
  0,
  1150000,
  1,
  0,
  '2026-09-11T05:00:00.000Z',
  '2026-09-11T05:00:00.000Z'
);

-- Booking 10: Becaaaaaaa (Haven 301)
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, instagram, facebook,
  num_guests, booking_type, checkin_at, checkout_at, late_checkout_hours,
  note, closing_note, status, base_price, extra_fee, discount_amount, total_price,
  created_by_staff_id, mod_no, created_at, updated_at
) VALUES (
  'EI-20261023-30110',
  'prop-01',
  'haven-301',
  '0866866904',
  'Becaaaaaaa',
  'Becaaaaaaa',
  NULL,
  2,
  'dayuse',
  '2026-10-23T08:00:00.000Z',
  '2026-10-26T05:00:00.000Z',
  0,
  'IG: Becaaaaaaa | Đã cọc',
  'Dạ vậy bên Home xin chốt là bên mình book',
  'confirmed',
  776000,
  0,
  0,
  776000,
  1,
  0,
  '2026-09-13T05:00:00.000Z',
  '2026-09-13T05:00:00.000Z'
);
