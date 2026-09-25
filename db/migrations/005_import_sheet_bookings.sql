-- ── 005_import_sheet_bookings.sql ──────────────────────────
-- Import 23 historical / active bookings from Google Sheet operation tracker
-- Generated for Cloudflare D1 (SQLite)

-- 1. Upsert Members into Mini CDP
INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0868651120',
  'phganh._8',
  1,
  376000,
  0,
  '2026-09-20T09:00:00.000Z',
  '2026-09-20T09:00:00.000Z',
  'new',
  'haven',
  'IG: phganh._8 | Chốt: Dạ vậy home xác nhận booking no.101 checkin 16H-20h 20/9 tổng là 376k ạ',
  0,
  0,
  '2026-09-19T05:00:00.000Z',
  '2026-09-19T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'IG:tournesol',
  'tournesol',
  1,
  800000,
  5,
  '2026-09-20T16:00:00.000Z',
  '2026-09-20T16:00:00.000Z',
  'bronze',
  'haven',
  'IG: tournesol | Chốt: Phần checkin lại 101 là đến 12h ngày 25/08 Giá 800k',
  0,
  0,
  '2026-09-17T05:00:00.000Z',
  '2026-09-17T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'IG:_gwd.ht',
  '_gwd.ht',
  1,
  679000,
  1,
  '2026-09-21T08:00:00.000Z',
  '2026-09-21T08:00:00.000Z',
  'bronze',
  'signature',
  'IG: _gwd.ht | Chốt: home vẫn xác nhận checkin 2 người từ 15h ngày 21/09 - check out 12h ngày 22/09',
  0,
  0,
  '2026-09-18T05:00:00.000Z',
  '2026-09-18T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'FB:Anh Ngô',
  'Anh Ngô',
  1,
  620000,
  1,
  '2026-09-21T14:00:00.000Z',
  '2026-09-21T14:00:00.000Z',
  'bronze',
  'signature',
  'FB: Anh Ngô | Chốt: Dạ home xác nhận bạn checkin bây giờ đến 9h sáng mai 22/09 tại 202 nhé',
  0,
  0,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'FB:Truc Mai zalo',
  'Truc Mai zalo',
  1,
  496000,
  1,
  '2026-09-21T14:00:00.000Z',
  '2026-09-21T14:00:00.000Z',
  'new',
  'signature',
  'FB: Truc Mai zalo',
  0,
  0,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'IG:Cô Xuân zalo',
  'Cô Xuân zalo',
  1,
  2100000,
  7,
  '2026-09-23T05:00:00.000Z',
  '2026-09-23T05:00:00.000Z',
  'bronze',
  'signature',
  'IG: Cô Xuân zalo',
  0,
  0,
  '2026-09-23T05:00:00.000Z',
  '2026-09-23T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0987865667',
  'hành a',
  1,
  596000,
  1,
  '2026-09-23T14:00:00.000Z',
  '2026-09-23T14:00:00.000Z',
  'bronze',
  'signature',
  'IG: hành a | Ghi chú: sale - Thêm 2h | Chốt: Home xác nhận checkin 3 người 21h ngày 23/09 - checkout 9h ngày 24/09 tại no.302 Tổng sau giảm và phu thu người thứ 3 là 596k ạ',
  0,
  0,
  '2026-09-19T05:00:00.000Z',
  '2026-09-19T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0903303315',
  'spiicytrash',
  1,
  392000,
  1,
  '2026-09-23T14:00:00.000Z',
  '2026-09-23T14:00:00.000Z',
  'new',
  'haven',
  'IG: spiicytrash | Ghi chú: sale | Chốt: Dạ vậy bên Home xin chốt là bên mình book 201 in 21H 23/9 out 9H 24/9 tổng là 392K ạaaaaa',
  0,
  0,
  '2026-09-22T05:00:00.000Z',
  '2026-09-22T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0342276346',
  'Hoàng Tuấn Minh',
  1,
  288000,
  0,
  '2026-09-24T02:00:00.000Z',
  '2026-09-24T02:00:00.000Z',
  'new',
  'signature',
  'IG: Hoàng Tuấn Minh | Ghi chú: dời khách này từ 102 qua 202 | Chốt: Dạ vậy home chốt booking 102 cho 2 người vào 24/9 9h check in - 12h check out tổng là 288k ạ',
  0,
  0,
  '2026-09-23T05:00:00.000Z',
  '2026-09-23T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'FB:Nhật Hoàng',
  'Nhật Hoàng',
  1,
  348000,
  0,
  '2026-09-24T12:00:00.000Z',
  '2026-09-24T12:00:00.000Z',
  'new',
  'signature',
  'FB: Nhật Hoàng',
  0,
  0,
  '2026-09-24T05:00:00.000Z',
  '2026-09-24T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0347890836',
  'Dũng airbnb',
  1,
  1091000,
  3,
  '2026-09-25T07:00:00.000Z',
  '2026-09-25T07:00:00.000Z',
  'bronze',
  'haven',
  'FB: Dũng airbnb | SĐT gốc: +84 347 890 836 | Chốt: 3 đêm airbnb khuyến mãi',
  0,
  0,
  '2026-09-18T05:00:00.000Z',
  '2026-09-18T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'IG:my_uyen8',
  'my_uyen8 (Uyen Tran AGODA)',
  1,
  1819000,
  5,
  '2026-09-25T08:00:00.000Z',
  '2026-09-25T08:00:00.000Z',
  'bronze',
  'signature',
  'IG: my_uyen8 | FB: Uyen Tran AGODA | Chốt: quá ác agoda sale 33% :) là 360/đêm',
  0,
  0,
  '2026-09-19T05:00:00.000Z',
  '2026-09-19T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0867663738',
  'Nhật Anh',
  1,
  710000,
  1,
  '2026-09-25T08:00:00.000Z',
  '2026-09-25T08:00:00.000Z',
  'bronze',
  'signature',
  'IG: Na Moè | Ghi chú: sale 40k | Chốt: Dạ vậy Home chốt cho bạn ca ngay t6 25/9 check-in 15h check-out 12h t7 26/9 phòng 202 tổng là 710k ạ ( giá gốc 750k)',
  0,
  0,
  '2026-09-24T05:00:00.000Z',
  '2026-09-24T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0934981930',
  'Trúc Quỳnh',
  1,
  490000,
  1,
  '2026-09-25T15:00:00.000Z',
  '2026-09-25T15:00:00.000Z',
  'new',
  'haven',
  'IG: Trúc Quỳnh | Chốt: Dạ mình book 101 in 0H 26/9 - out 9h 26/9 tổng là 490K ạ Dạ vẫn còn ạ',
  0,
  0,
  '2026-09-17T05:00:00.000Z',
  '2026-09-17T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'IG:Lemo zalo',
  'Lemo zalo',
  1,
  350000,
  1,
  '2026-09-30T10:00:00.000Z',
  '2026-09-30T10:00:00.000Z',
  'new',
  'haven',
  'IG: Lemo zalo | SĐT gốc: Airbnb | Chốt: 590 sale gì đó giảm 118k và mất 80k phí airbnb',
  0,
  0,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0918841638',
  'Anh Duc Vu',
  1,
  685000,
  2,
  '2026-10-02T15:00:00.000Z',
  '2026-10-02T15:00:00.000Z',
  'bronze',
  'signature',
  'IG: Anh Duc Vu | Ghi chú: cọc 50% | Chốt: Dạ vậy bên Home xin chốt là bên mình book 102 in 22H 2/10 và out 12H 4/10 tổng là 1tr370 ạaaaa',
  0,
  0,
  '2026-09-12T05:00:00.000Z',
  '2026-09-12T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0377863799',
  'Thaotica',
  1,
  440000,
  1,
  '2026-10-02T17:00:00.000Z',
  '2026-10-02T17:00:00.000Z',
  'new',
  'haven',
  'IG: Thaotica | Ghi chú: giảm 50k | Chốt: vậy mình cho cho bạn check in ngày 3/10 lúc 0h checkout 3/10 lúc 12h tổng giá là 440k, giá đã giảm 50k cho bạn của Ngọc Hà',
  0,
  0,
  '2026-09-09T05:00:00.000Z',
  '2026-09-09T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'FB:Thy tr',
  'Thy tr',
  1,
  1349000,
  2,
  '2026-10-03T11:00:00.000Z',
  '2026-10-03T11:00:00.000Z',
  'bronze',
  'signature',
  'FB: Thy tr | Ghi chú: Cọc 50% | Chốt: Dạa vậy home xác nhận checkin 18h ngày 03/10 - checkout 12h ngày 05/10 tại Signature 202 1tr349 ạ',
  0,
  0,
  '2026-09-22T05:00:00.000Z',
  '2026-09-22T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  'IG:khangtrainer',
  'khangtrainer',
  1,
  1416000,
  3,
  '2026-10-05T08:00:00.000Z',
  '2026-10-05T08:00:00.000Z',
  'bronze',
  'haven',
  'IG: khangtrainer | Chốt: Dạ vậy home xác nhận checkin 2 người từ 15h ngày 6/10 - checkout 12h ngày 8/10 tại Haven 101 944k ạ',
  0,
  0,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0979027234',
  'Quỳnh Anh',
  1,
  1350000,
  4,
  '2026-10-15T06:00:00.000Z',
  '2026-10-15T06:00:00.000Z',
  'bronze',
  'signature',
  'IG: quynhanhh___ | Ghi chú: cọc 50% | Chốt: Dạ home xác nhận checkin 2 người từ 13h ngày 15/10 và check out 8h sáng 19/10 tại no.102 Giá 3.000.000 cho 4 đêm, được giảm 10% ưu đãi đặt trước Còn lại tổng là 2tr700 ạ',
  0,
  0,
  '2026-09-14T05:00:00.000Z',
  '2026-09-14T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0342923037',
  'ryiihope',
  1,
  590000,
  1,
  '2026-10-17T08:00:00.000Z',
  '2026-10-17T08:00:00.000Z',
  'bronze',
  'haven',
  'IG: ryiihope | Chốt: Vậy bên Home xin chốt là bên mình book 301 in 15h 17/10 out 12H 18/10 tổng là 590K ạaaaa',
  0,
  0,
  '2026-09-08T05:00:00.000Z',
  '2026-09-08T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0989937518',
  'Linh Đoan',
  1,
  1150000,
  4,
  '2026-10-17T15:00:00.000Z',
  '2026-10-17T15:00:00.000Z',
  'bronze',
  'signature',
  'IG: Linh Đoan | Ghi chú: sale cọc 50% | Chốt: Dạ vậy home xin xác nhận checkin từ 22h ngày 17/10 - checkout 12h ngày 21/10 tại Signature 202 Tổng áp dụng ưu đãi hiện tại cho bạn luôn ạ, là 2tr300',
  0,
  0,
  '2026-09-11T05:00:00.000Z',
  '2026-09-11T05:00:00.000Z'
);

INSERT OR REPLACE INTO members (
  phone, full_name, total_bookings, total_spent, total_nights,
  first_booked_at, last_booked_at, loyalty_tier, preferred_room_class,
  internal_notes, is_blocked, portal_opt_in, created_at, updated_at
) VALUES (
  '0866866904',
  'Becaaaaaaa',
  1,
  776000,
  3,
  '2026-10-23T08:00:00.000Z',
  '2026-10-23T08:00:00.000Z',
  'bronze',
  'haven',
  'IG: Becaaaaaaa | SĐT gốc: 0866 866 904 | Ghi chú: cọc | Chốt: Dạ vậy bên Home xin chốt là bên mình boôk 301 in 15H 23/10 out 12H 26/10 tổng là 1tr552, bạn cọc 50% là 776K ạaaaaa',
  0,
  0,
  '2026-09-13T05:00:00.000Z',
  '2026-09-13T05:00:00.000Z'
);

-- 2. Insert or Replace Bookings
INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260920-10101',
  'prop-01',
  'haven-101',
  '0868651120',
  'phganh._8',
  2,
  'hourly',
  '2026-09-20T09:00:00.000Z',
  '2026-09-20T14:00:00.000Z',
  0,
  'IG: phganh._8 | Chốt: Dạ vậy home xác nhận booking no.101 checkin 16H-20h 20/9 tổng là 376k ạ',
  1,
  'confirmed',
  376000,
  0,
  0,
  376000,
  '2026-09-19T05:00:00.000Z',
  '2026-09-19T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260920-10102',
  'prop-01',
  'haven-101',
  'IG:tournesol',
  'tournesol',
  2,
  'dayuse',
  '2026-09-20T16:00:00.000Z',
  '2026-09-25T11:00:00.000Z',
  0,
  'IG: tournesol | Chốt: Phần checkin lại 101 là đến 12h ngày 25/08 Giá 800k',
  1,
  'confirmed',
  800000,
  0,
  0,
  800000,
  '2026-09-17T05:00:00.000Z',
  '2026-09-17T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260921-30203',
  'prop-01',
  'sig-302',
  'IG:_gwd.ht',
  '_gwd.ht',
  2,
  'dayuse',
  '2026-09-21T08:00:00.000Z',
  '2026-09-22T07:00:00.000Z',
  2,
  'IG: _gwd.ht | Chốt: home vẫn xác nhận checkin 2 người từ 15h ngày 21/09 - check out 12h ngày 22/09',
  1,
  'confirmed',
  679000,
  0,
  0,
  679000,
  '2026-09-18T05:00:00.000Z',
  '2026-09-18T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260921-20204',
  'prop-01',
  'sig-202',
  'FB:Anh Ngô',
  'Anh Ngô',
  2,
  'overnight',
  '2026-09-21T14:00:00.000Z',
  '2026-09-22T04:00:00.000Z',
  2,
  'FB: Anh Ngô | Chốt: Dạ home xác nhận bạn checkin bây giờ đến 9h sáng mai 22/09 tại 202 nhé',
  1,
  'confirmed',
  620000,
  0,
  0,
  620000,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260921-10205',
  'prop-01',
  'sig-102',
  'FB:Truc Mai zalo',
  'Truc Mai zalo',
  2,
  'overnight',
  '2026-09-21T14:00:00.000Z',
  '2026-09-22T03:00:00.000Z',
  1,
  'FB: Truc Mai zalo',
  1,
  'confirmed',
  496000,
  0,
  0,
  496000,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260923-10206',
  'prop-01',
  'sig-102',
  'IG:Cô Xuân zalo',
  'Cô Xuân zalo',
  2,
  'dayuse',
  '2026-09-23T05:00:00.000Z',
  '2026-09-30T05:00:00.000Z',
  0,
  'IG: Cô Xuân zalo',
  1,
  'confirmed',
  2100000,
  0,
  0,
  2100000,
  '2026-09-23T05:00:00.000Z',
  '2026-09-23T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260923-30207',
  'prop-01',
  'sig-302',
  '0987865667',
  'hành a',
  3,
  'overnight',
  '2026-09-23T14:00:00.000Z',
  '2026-09-24T04:00:00.000Z',
  2,
  'IG: hành a | Ghi chú: sale - Thêm 2h | Chốt: Home xác nhận checkin 3 người 21h ngày 23/09 - checkout 9h ngày 24/09 tại no.302 Tổng sau giảm và phu thu người thứ 3 là 596k ạ',
  1,
  'confirmed',
  596000,
  0,
  0,
  596000,
  '2026-09-19T05:00:00.000Z',
  '2026-09-19T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260923-20108',
  'prop-01',
  'haven-201',
  '0903303315',
  'spiicytrash',
  2,
  'overnight',
  '2026-09-23T14:00:00.000Z',
  '2026-09-24T02:00:00.000Z',
  0,
  'IG: spiicytrash | Ghi chú: sale | Chốt: Dạ vậy bên Home xin chốt là bên mình book 201 in 21H 23/9 out 9H 24/9 tổng là 392K ạaaaaa',
  1,
  'confirmed',
  392000,
  0,
  0,
  392000,
  '2026-09-22T05:00:00.000Z',
  '2026-09-22T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260924-20209',
  'prop-01',
  'sig-202',
  '0342276346',
  'Hoàng Tuấn Minh',
  2,
  'hourly',
  '2026-09-24T02:00:00.000Z',
  '2026-09-24T05:00:00.000Z',
  0,
  'IG: Hoàng Tuấn Minh | Ghi chú: dời khách này từ 102 qua 202 | Chốt: Dạ vậy home chốt booking 102 cho 2 người vào 24/9 9h check in - 12h check out tổng là 288k ạ',
  1,
  'confirmed',
  288000,
  0,
  0,
  288000,
  '2026-09-23T05:00:00.000Z',
  '2026-09-23T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260924-20210',
  'prop-01',
  'sig-202',
  'FB:Nhật Hoàng',
  'Nhật Hoàng',
  2,
  'hourly',
  '2026-09-24T12:00:00.000Z',
  '2026-09-24T15:00:00.000Z',
  0,
  'FB: Nhật Hoàng',
  1,
  'confirmed',
  348000,
  0,
  0,
  348000,
  '2026-09-24T05:00:00.000Z',
  '2026-09-24T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260925-20111',
  'prop-01',
  'haven-201',
  '0347890836',
  'Dũng airbnb',
  2,
  'dayuse',
  '2026-09-25T07:00:00.000Z',
  '2026-09-28T05:00:00.000Z',
  0,
  'FB: Dũng airbnb | SĐT gốc: +84 347 890 836 | Chốt: 3 đêm airbnb khuyến mãi',
  1,
  'confirmed',
  1091000,
  0,
  0,
  1091000,
  '2026-09-18T05:00:00.000Z',
  '2026-09-18T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260925-30212',
  'prop-01',
  'sig-302',
  'IG:my_uyen8',
  'my_uyen8 (Uyen Tran AGODA)',
  2,
  'dayuse',
  '2026-09-25T08:00:00.000Z',
  '2026-09-30T05:00:00.000Z',
  0,
  'IG: my_uyen8 | FB: Uyen Tran AGODA | Chốt: quá ác agoda sale 33% :) là 360/đêm',
  1,
  'confirmed',
  1819000,
  0,
  0,
  1819000,
  '2026-09-19T05:00:00.000Z',
  '2026-09-19T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260925-20213',
  'prop-01',
  'sig-202',
  '0867663738',
  'Nhật Anh',
  2,
  'dayuse',
  '2026-09-25T08:00:00.000Z',
  '2026-09-26T05:00:00.000Z',
  0,
  'IG: Na Moè | Ghi chú: sale 40k | Chốt: Dạ vậy Home chốt cho bạn ca ngay t6 25/9 check-in 15h check-out 12h t7 26/9 phòng 202 tổng là 710k ạ ( giá gốc 750k)',
  1,
  'confirmed',
  710000,
  0,
  0,
  710000,
  '2026-09-24T05:00:00.000Z',
  '2026-09-24T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260925-10114',
  'prop-01',
  'haven-101',
  '0934981930',
  'Trúc Quỳnh',
  2,
  'overnight',
  '2026-09-25T15:00:00.000Z',
  '2026-09-26T02:00:00.000Z',
  0,
  'IG: Trúc Quỳnh | Chốt: Dạ mình book 101 in 0H 26/9 - out 9h 26/9 tổng là 490K ạ Dạ vẫn còn ạ',
  1,
  'confirmed',
  490000,
  0,
  0,
  490000,
  '2026-09-17T05:00:00.000Z',
  '2026-09-17T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20260930-30115',
  'prop-01',
  'haven-301',
  'IG:Lemo zalo',
  'Lemo zalo',
  2,
  'dayuse',
  '2026-09-30T10:00:00.000Z',
  '2026-10-01T05:00:00.000Z',
  0,
  'IG: Lemo zalo | SĐT gốc: Airbnb | Chốt: 590 sale gì đó giảm 118k và mất 80k phí airbnb',
  1,
  'confirmed',
  350000,
  0,
  0,
  350000,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20261002-10216',
  'prop-01',
  'sig-102',
  '0918841638',
  'Anh Duc Vu',
  2,
  'dayuse',
  '2026-10-02T15:00:00.000Z',
  '2026-10-04T05:00:00.000Z',
  0,
  'IG: Anh Duc Vu | Ghi chú: cọc 50% | Chốt: Dạ vậy bên Home xin chốt là bên mình book 102 in 22H 2/10 và out 12H 4/10 tổng là 1tr370 ạaaaa',
  1,
  'confirmed',
  685000,
  0,
  0,
  685000,
  '2026-09-12T05:00:00.000Z',
  '2026-09-12T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20261003-10117',
  'prop-01',
  'haven-101',
  '0377863799',
  'Thaotica',
  2,
  'overnight',
  '2026-10-02T17:00:00.000Z',
  '2026-10-03T05:00:00.000Z',
  3,
  'IG: Thaotica | Ghi chú: giảm 50k | Chốt: vậy mình cho cho bạn check in ngày 3/10 lúc 0h checkout 3/10 lúc 12h tổng giá là 440k, giá đã giảm 50k cho bạn của Ngọc Hà',
  1,
  'confirmed',
  440000,
  0,
  0,
  440000,
  '2026-09-09T05:00:00.000Z',
  '2026-09-09T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20261003-20218',
  'prop-01',
  'sig-202',
  'FB:Thy tr',
  'Thy tr',
  2,
  'dayuse',
  '2026-10-03T11:00:00.000Z',
  '2026-10-05T05:00:00.000Z',
  0,
  'FB: Thy tr | Ghi chú: Cọc 50% | Chốt: Dạa vậy home xác nhận checkin 18h ngày 03/10 - checkout 12h ngày 05/10 tại Signature 202 1tr349 ạ',
  1,
  'confirmed',
  1349000,
  0,
  0,
  1349000,
  '2026-09-22T05:00:00.000Z',
  '2026-09-22T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20261005-10119',
  'prop-01',
  'haven-101',
  'IG:khangtrainer',
  'khangtrainer',
  2,
  'dayuse',
  '2026-10-05T08:00:00.000Z',
  '2026-10-08T05:00:00.000Z',
  0,
  'IG: khangtrainer | Chốt: Dạ vậy home xác nhận checkin 2 người từ 15h ngày 6/10 - checkout 12h ngày 8/10 tại Haven 101 944k ạ',
  1,
  'confirmed',
  1416000,
  0,
  0,
  1416000,
  '2026-09-21T05:00:00.000Z',
  '2026-09-21T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20261015-10220',
  'prop-01',
  'sig-102',
  '0979027234',
  'Quỳnh Anh',
  2,
  'dayuse',
  '2026-10-15T06:00:00.000Z',
  '2026-10-19T01:00:00.000Z',
  0,
  'IG: quynhanhh___ | Ghi chú: cọc 50% | Chốt: Dạ home xác nhận checkin 2 người từ 13h ngày 15/10 và check out 8h sáng 19/10 tại no.102 Giá 3.000.000 cho 4 đêm, được giảm 10% ưu đãi đặt trước Còn lại tổng là 2tr700 ạ',
  1,
  'confirmed',
  1350000,
  0,
  0,
  1350000,
  '2026-09-14T05:00:00.000Z',
  '2026-09-14T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20261017-30121',
  'prop-01',
  'haven-301',
  '0342923037',
  'ryiihope',
  2,
  'dayuse',
  '2026-10-17T08:00:00.000Z',
  '2026-10-18T05:00:00.000Z',
  0,
  'IG: ryiihope | Chốt: Vậy bên Home xin chốt là bên mình book 301 in 15h 17/10 out 12H 18/10 tổng là 590K ạaaaa',
  1,
  'confirmed',
  590000,
  0,
  0,
  590000,
  '2026-09-08T05:00:00.000Z',
  '2026-09-08T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20261017-20222',
  'prop-01',
  'sig-202',
  '0989937518',
  'Linh Đoan',
  2,
  'dayuse',
  '2026-10-17T15:00:00.000Z',
  '2026-10-21T05:00:00.000Z',
  0,
  'IG: Linh Đoan | Ghi chú: sale cọc 50% | Chốt: Dạ vậy home xin xác nhận checkin từ 22h ngày 17/10 - checkout 12h ngày 21/10 tại Signature 202 Tổng áp dụng ưu đãi hiện tại cho bạn luôn ạ, là 2tr300',
  1,
  'confirmed',
  1150000,
  0,
  0,
  1150000,
  '2026-09-11T05:00:00.000Z',
  '2026-09-11T05:00:00.000Z'
);

INSERT OR REPLACE INTO bookings (
  id, property_id, room_id, member_phone, member_name, num_guests,
  booking_type, checkin_at, checkout_at, late_checkout_hours, note,
  created_by_staff_id, status, base_price, extra_fee, discount_amount, total_price,
  created_at, updated_at
) VALUES (
  'EI-20261023-30123',
  'prop-01',
  'haven-301',
  '0866866904',
  'Becaaaaaaa',
  2,
  'dayuse',
  '2026-10-23T08:00:00.000Z',
  '2026-10-26T05:00:00.000Z',
  0,
  'IG: Becaaaaaaa | SĐT gốc: 0866 866 904 | Ghi chú: cọc | Chốt: Dạ vậy bên Home xin chốt là bên mình boôk 301 in 15H 23/10 out 12H 26/10 tổng là 1tr552, bạn cọc 50% là 776K ạaaaaa',
  1,
  'confirmed',
  776000,
  0,
  0,
  776000,
  '2026-09-13T05:00:00.000Z',
  '2026-09-13T05:00:00.000Z'
);

-- 3. Log Audit Events
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260920-10101', '{"importedFrom":"Google Sheet","bookingId":"EI-20260920-10101","roomId":"haven-101","phone":"0868651120","name":"phganh._8","totalPrice":376000,"bookingType":"hourly"}', 1, '2026-09-19T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260920-10102', '{"importedFrom":"Google Sheet","bookingId":"EI-20260920-10102","roomId":"haven-101","phone":"IG:tournesol","name":"tournesol","totalPrice":800000,"bookingType":"dayuse"}', 1, '2026-09-17T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260921-30203', '{"importedFrom":"Google Sheet","bookingId":"EI-20260921-30203","roomId":"sig-302","phone":"IG:_gwd.ht","name":"_gwd.ht","totalPrice":679000,"bookingType":"dayuse"}', 1, '2026-09-18T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260921-20204', '{"importedFrom":"Google Sheet","bookingId":"EI-20260921-20204","roomId":"sig-202","phone":"FB:Anh Ngô","name":"Anh Ngô","totalPrice":620000,"bookingType":"overnight"}', 1, '2026-09-21T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260921-10205', '{"importedFrom":"Google Sheet","bookingId":"EI-20260921-10205","roomId":"sig-102","phone":"FB:Truc Mai zalo","name":"Truc Mai zalo","totalPrice":496000,"bookingType":"overnight"}', 1, '2026-09-21T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260923-10206', '{"importedFrom":"Google Sheet","bookingId":"EI-20260923-10206","roomId":"sig-102","phone":"IG:Cô Xuân zalo","name":"Cô Xuân zalo","totalPrice":2100000,"bookingType":"dayuse"}', 1, '2026-09-23T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260923-30207', '{"importedFrom":"Google Sheet","bookingId":"EI-20260923-30207","roomId":"sig-302","phone":"0987865667","name":"hành a","totalPrice":596000,"bookingType":"overnight"}', 1, '2026-09-19T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260923-20108', '{"importedFrom":"Google Sheet","bookingId":"EI-20260923-20108","roomId":"haven-201","phone":"0903303315","name":"spiicytrash","totalPrice":392000,"bookingType":"overnight"}', 1, '2026-09-22T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260924-20209', '{"importedFrom":"Google Sheet","bookingId":"EI-20260924-20209","roomId":"sig-202","phone":"0342276346","name":"Hoàng Tuấn Minh","totalPrice":288000,"bookingType":"hourly"}', 1, '2026-09-23T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260924-20210', '{"importedFrom":"Google Sheet","bookingId":"EI-20260924-20210","roomId":"sig-202","phone":"FB:Nhật Hoàng","name":"Nhật Hoàng","totalPrice":348000,"bookingType":"hourly"}', 1, '2026-09-24T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260925-20111', '{"importedFrom":"Google Sheet","bookingId":"EI-20260925-20111","roomId":"haven-201","phone":"0347890836","name":"Dũng airbnb","totalPrice":1091000,"bookingType":"dayuse"}', 1, '2026-09-18T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260925-30212', '{"importedFrom":"Google Sheet","bookingId":"EI-20260925-30212","roomId":"sig-302","phone":"IG:my_uyen8","name":"my_uyen8 (Uyen Tran AGODA)","totalPrice":1819000,"bookingType":"dayuse"}', 1, '2026-09-19T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260925-20213', '{"importedFrom":"Google Sheet","bookingId":"EI-20260925-20213","roomId":"sig-202","phone":"0867663738","name":"Nhật Anh","totalPrice":710000,"bookingType":"dayuse"}', 1, '2026-09-24T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260925-10114', '{"importedFrom":"Google Sheet","bookingId":"EI-20260925-10114","roomId":"haven-101","phone":"0934981930","name":"Trúc Quỳnh","totalPrice":490000,"bookingType":"overnight"}', 1, '2026-09-17T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20260930-30115', '{"importedFrom":"Google Sheet","bookingId":"EI-20260930-30115","roomId":"haven-301","phone":"IG:Lemo zalo","name":"Lemo zalo","totalPrice":350000,"bookingType":"dayuse"}', 1, '2026-09-21T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20261002-10216', '{"importedFrom":"Google Sheet","bookingId":"EI-20261002-10216","roomId":"sig-102","phone":"0918841638","name":"Anh Duc Vu","totalPrice":685000,"bookingType":"dayuse"}', 1, '2026-09-12T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20261003-10117', '{"importedFrom":"Google Sheet","bookingId":"EI-20261003-10117","roomId":"haven-101","phone":"0377863799","name":"Thaotica","totalPrice":440000,"bookingType":"overnight"}', 1, '2026-09-09T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20261003-20218', '{"importedFrom":"Google Sheet","bookingId":"EI-20261003-20218","roomId":"sig-202","phone":"FB:Thy tr","name":"Thy tr","totalPrice":1349000,"bookingType":"dayuse"}', 1, '2026-09-22T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20261005-10119', '{"importedFrom":"Google Sheet","bookingId":"EI-20261005-10119","roomId":"haven-101","phone":"IG:khangtrainer","name":"khangtrainer","totalPrice":1416000,"bookingType":"dayuse"}', 1, '2026-09-21T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20261015-10220', '{"importedFrom":"Google Sheet","bookingId":"EI-20261015-10220","roomId":"sig-102","phone":"0979027234","name":"Quỳnh Anh","totalPrice":1350000,"bookingType":"dayuse"}', 1, '2026-09-14T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20261017-30121', '{"importedFrom":"Google Sheet","bookingId":"EI-20261017-30121","roomId":"haven-301","phone":"0342923037","name":"ryiihope","totalPrice":590000,"bookingType":"dayuse"}', 1, '2026-09-08T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20261017-20222', '{"importedFrom":"Google Sheet","bookingId":"EI-20261017-20222","roomId":"sig-202","phone":"0989937518","name":"Linh Đoan","totalPrice":1150000,"bookingType":"dayuse"}', 1, '2026-09-11T05:00:00.000Z');
INSERT INTO event_logs (event_type, entity_type, entity_id, payload, staff_id, created_at)
VALUES ('BOOKING_IMPORTED', 'booking', 'EI-20261023-30123', '{"importedFrom":"Google Sheet","bookingId":"EI-20261023-30123","roomId":"haven-301","phone":"0866866904","name":"Becaaaaaaa","totalPrice":776000,"bookingType":"dayuse"}', 1, '2026-09-13T05:00:00.000Z');
