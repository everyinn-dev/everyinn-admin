# Every Inn Admin Panel — MVP Build Plan (Revised)
## 2 Features Only: Room Dashboard + Create Booking

> **New project. New repo. New Cloudflare Worker.**  
> Stack: Next.js 16 · TypeScript · Tailwind CSS 4 · Cloudflare D1 · OpenNext  
> Path: `/Users/lap14666/Documents/private/every inn/everyinn-admin`

---

## MVP Scope — Hard Cut

| Feature | MVP | Future |
|---|---|---|
| Staff login (phone + password) | ✅ | |
| **Room Dashboard (Gantt)** | ✅ | |
| **Create Booking form** | ✅ | |
| CDP: phone lookup → auto-fill | ✅ | |
| CDP: member upsert on booking save | ✅ | |
| Audit event log (write-only) | ✅ | |
| Hold room 5 min | | ✅ |
| Payment confirmation screen | | ✅ |
| Manual confirm / cancel | | ✅ |
| Telegram notifications | | ✅ |
| Door code generation | | ✅ |
| Discount codes | | ✅ |
| Config CRUD screens | | ✅ |
| R2 ID card upload | | ✅ |
| Guest portal (external domain) | | ✅ |

**Receptionist flow (MVP):**
> Look at Dashboard → see which rooms are free → tell customer → fill Create Booking form → done. Payment handled in person.

---

## Part 1 — Project Structure

```
everyinn-admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                     → redirect: auth? /dashboard : /login
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── bookings/
│   │   │   ├── new/page.tsx             → Create Booking form
│   │   │   └── [id]/page.tsx            → Booking detail (read, future edit)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   └── logout/route.ts
│   │       ├── members/
│   │       │   └── [phone]/route.ts     → GET (CDP phone lookup)
│   │       ├── bookings/
│   │       │   ├── route.ts             → POST create, GET list
│   │       │   └── [id]/route.ts        → GET single
│   │       └── dashboard/
│   │           └── gantt/route.ts       → GET gantt data for a date
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Spinner.tsx
│   │   ├── layout/
│   │   │   ├── AdminShell.tsx           → nav sidebar + topbar wrapper
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── dashboard/
│   │   │   ├── GanttChart.tsx           → desktop timeline grid
│   │   │   ├── GanttRoomRow.tsx         → one room row in Gantt
│   │   │   ├── GanttBar.tsx             → one booking bar
│   │   │   ├── GanttTooltip.tsx         → hover card
│   │   │   ├── BookingDetailDrawer.tsx  → slide-in panel on bar click
│   │   │   ├── MobileRoomCard.tsx       → mobile per-room card
│   │   │   ├── MobileBookingChip.tsx    → booking chip in mobile card
│   │   │   └── DateNavBar.tsx           → ← date → navigation + Today btn
│   │   └── bookings/
│   │       ├── BookingForm.tsx          → main create form component
│   │       ├── PhoneLookupField.tsx     → phone input + CDP auto-fill
│   │       ├── BookingTypeTabs.tsx      → hourly/overnight/dayuse selector
│   │       ├── HourlyFields.tsx         → date, checkin hour, duration
│   │       ├── OvernightFields.tsx      → date, start time, late checkout
│   │       ├── DayUseFields.tsx         → date, nights, late checkout
│   │       └── PriceSummaryCard.tsx     → live price breakdown
│   ├── lib/
│   │   ├── db.ts                        → D1 query helpers
│   │   ├── auth.ts                      → session cookie helpers
│   │   ├── audit.ts                     → logEvent() — append to event_logs
│   │   ├── pricing.ts                   → calcTotal(), resolveCombo()
│   │   ├── cdp.ts                       → lookupMember(), upsertMember(), calcTier()
│   │   └── bookingId.ts                 → generateBookingId() "EI-YYYYMMDD-XXXX"
│   └── types/index.ts                   → shared TS types for Booking, Member, Room…
├── db/
│   ├── migrations/
│   │   ├── 001_tables.sql
│   │   └── 002_seed.sql
│   └── README.md                        → how to run migrations
├── wrangler.jsonc
├── next.config.ts
├── open-next.config.ts
├── package.json
└── tsconfig.json
```

---

## Part 2 — MVP Database Schema

### `001_tables.sql`

```sql
-- ── MASTER DATA ─────────────────────────────────

CREATE TABLE properties (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  address             TEXT NOT NULL,
  bank_id             TEXT NOT NULL,
  bank_account        TEXT NOT NULL,
  bank_holder_name    TEXT NOT NULL,
  checkin_instruction TEXT,
  wifi_ssid           TEXT,
  wifi_password       TEXT,
  telegram_chat_id    TEXT,             -- saved now, used in future phase
  is_active           INTEGER DEFAULT 1,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE rooms (
  id          TEXT PRIMARY KEY,         -- "haven-101"
  property_id TEXT NOT NULL,
  room_number TEXT NOT NULL,            -- "101"
  name        TEXT NOT NULL,            -- "Haven 101"
  room_class  TEXT NOT NULL,            -- "haven" | "signature"
  floor       INTEGER NOT NULL,
  area_sqm    INTEGER,
  max_guests  INTEGER NOT NULL DEFAULT 2,
  sort_order  INTEGER DEFAULT 0,        -- controls Y-axis order in Gantt
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE pricing_rules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id    TEXT NOT NULL,
  room_class     TEXT NOT NULL,
  booking_type   TEXT NOT NULL,         -- "combo3h"|"combo6h"|"overnight"|"dayroom"
  base_price     INTEGER NOT NULL,
  extra_hour_fee INTEGER DEFAULT 60000,
  is_active      INTEGER DEFAULT 1,
  created_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE configs (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,            -- JSON-encoded
  description TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── STAFF ───────────────────────────────────────

CREATE TABLE staff (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'receptionist', -- "receptionist"|"manager"
  is_active     INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE staff_sessions (
  token      TEXT PRIMARY KEY,
  staff_id   INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- ── CDP ─────────────────────────────────────────

CREATE TABLE members (
  phone                TEXT PRIMARY KEY,
  full_name            TEXT,
  total_bookings       INTEGER DEFAULT 0,
  total_spent          INTEGER DEFAULT 0,   -- VND cumulative
  total_nights         INTEGER DEFAULT 0,
  first_booked_at      TEXT,
  last_booked_at       TEXT,
  loyalty_tier         TEXT DEFAULT 'new',  -- new|bronze|silver|gold
  preferred_room_class TEXT,                -- inferred from history
  internal_notes       TEXT,
  is_blocked           INTEGER DEFAULT 0,
  portal_opt_in        INTEGER DEFAULT 0,   -- for future guest portal
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_members_tier ON members(loyalty_tier);

-- ── BOOKINGS ────────────────────────────────────

CREATE TABLE bookings (
  id                   TEXT PRIMARY KEY,    -- "EI-20260924-A3K9"
  property_id          TEXT NOT NULL,
  room_id              TEXT NOT NULL,
  member_phone         TEXT NOT NULL,
  member_name          TEXT NOT NULL,
  num_guests           INTEGER NOT NULL,
  booking_type         TEXT NOT NULL,       -- "hourly"|"overnight"|"dayuse"
  checkin_at           TEXT NOT NULL,       -- ISO datetime
  checkout_at          TEXT NOT NULL,
  late_checkout_hours  INTEGER DEFAULT 0,
  note                 TEXT,
  created_by_staff_id  INTEGER,

  -- Status (MVP: only pending/confirmed used; others reserved for future)
  status               TEXT DEFAULT 'confirmed',
  -- Future: pending|holding|confirmed|hold_expired|cancelled

  -- Pricing snapshot (locked at creation time)
  base_price           INTEGER NOT NULL,
  extra_fee            INTEGER DEFAULT 0,
  discount_amount      INTEGER DEFAULT 0,
  total_price          INTEGER NOT NULL,

  -- Future fields (nullable, unused in MVP)
  hold_expires_at      TEXT,
  payment_confirmed_at TEXT,
  payment_confirmed_by INTEGER,
  door_code            TEXT,
  door_code_sent_at    TEXT,
  public_token         TEXT UNIQUE,         -- for future guest portal lookup
  cancelled_at         TEXT,
  cancel_reason        TEXT,
  cancelled_by         INTEGER,

  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_bookings_status    ON bookings(status);
CREATE INDEX idx_bookings_member    ON bookings(member_phone);
CREATE INDEX idx_bookings_room_date ON bookings(room_id, checkin_at, checkout_at);
CREATE INDEX idx_bookings_token     ON bookings(public_token);

-- ── AUDIT LOG (append-only, never update/delete) ─

CREATE TABLE event_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type    TEXT NOT NULL,
  booking_id    TEXT,
  member_phone  TEXT,
  room_id       TEXT,
  staff_id      INTEGER,
  actor         TEXT NOT NULL,   -- "receptionist"|"system"|"cron"
  payload       TEXT,            -- JSON: full context
  result        TEXT,            -- "success"|"error"
  error_message TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_event_logs_booking ON event_logs(booking_id);
CREATE INDEX idx_event_logs_type    ON event_logs(event_type, created_at);
```

### `002_seed.sql`

```sql
INSERT INTO properties VALUES (
  'pxl', 'Every Inn Phan Xích Long',
  'Hẻm 30 Nguyễn Công Hoan, Phan Xích Long, Phú Nhuận, TP.HCM',
  'MB', '1234567890', 'CONG TY TNHH EVERY INN',
  '# Hướng dẫn nhận phòng
...hướng dẫn vào nhà...', 'EveryInn_WiFi', 'everyinn2024',
  NULL, 1, datetime('now'), datetime('now')
);

INSERT INTO rooms VALUES
  ('haven-101',     'pxl','101','Haven 101',    'haven',    1,20,2,1,1,datetime('now'),datetime('now')),
  ('haven-201',     'pxl','201','Haven 201',    'haven',    2,20,2,2,1,datetime('now'),datetime('now')),
  ('haven-301',     'pxl','301','Haven 301',    'haven',    3,20,2,3,1,datetime('now'),datetime('now')),
  ('signature-102', 'pxl','102','Signature 102','signature',1,28,2,4,1,datetime('now'),datetime('now')),
  ('signature-202', 'pxl','202','Signature 202','signature',2,30,2,5,1,datetime('now'),datetime('now')),
  ('signature-302', 'pxl','302','Signature 302','signature',3,30,2,6,1,datetime('now'),datetime('now'));

INSERT INTO pricing_rules (property_id,room_class,booking_type,base_price) VALUES
  ('pxl','haven',    'combo3h',  320000),
  ('pxl','haven',    'combo6h',  600000),
  ('pxl','haven',    'overnight',490000),
  ('pxl','haven',    'dayroom',  590000),
  ('pxl','signature','combo3h',  360000),
  ('pxl','signature','combo6h',  640000),
  ('pxl','signature','overnight',620000),
  ('pxl','signature','dayroom',  750000);

INSERT INTO configs VALUES
  ('hold_duration_seconds',       '300',     'Future: hold lock duration'),
  ('max_late_checkout_hours',     '6',       'Max late checkout hours'),
  ('extra_hour_fee',              '60000',   'VND per extra hour'),
  ('session_ttl_hours',           '8',       'Staff session duration hours'),
  ('loyalty_bronze_min_bookings', '1',       NULL),
  ('loyalty_silver_min_bookings', '5',       NULL),
  ('loyalty_gold_min_bookings',   '10',      NULL),
  ('loyalty_bronze_min_spent',    '500000',  NULL),
  ('loyalty_silver_min_spent',    '3000000', NULL),
  ('loyalty_gold_min_spent',      '8000000', NULL);

-- Staff: password "everyinn2024" (bcrypt hash generated by seed script at deploy time)
-- INSERT INTO staff done by npm run db:seed script, not raw SQL
```

---

## Part 3 — API Routes (MVP Only)

All routes require valid `session` cookie (except `/api/auth/login`).

| Method | Route | Body / Params | Returns |
|---|---|---|---|
| `POST` | `/api/auth/login` | `{phone, password}` | sets `session` cookie, `{staff}` |
| `POST` | `/api/auth/logout` | — | clears cookie |
| `GET` | `/api/members/:phone` | — | `{found, full_name, loyalty_tier, total_bookings, total_spent, last_booked_at}` |
| `POST` | `/api/bookings` | booking payload (see below) | `{id, booking}` |
| `GET` | `/api/bookings` | `?date&room_id&status` | `{bookings[]}` |
| `GET` | `/api/bookings/:id` | — | `{booking}` |
| `GET` | `/api/dashboard/gantt` | `?date=YYYY-MM-DD` | `{rooms[], bookings[]}` |

### `POST /api/bookings` payload
```typescript
{
  room_id: string;
  member_phone: string;
  member_name: string;
  num_guests: number;
  booking_type: 'hourly' | 'overnight' | 'dayuse';
  checkin_at: string;    // ISO datetime
  checkout_at: string;   // ISO datetime
  late_checkout_hours: number;
  note?: string;
}
```
**On success:** creates booking (status=`confirmed`), upserts member in CDP, logs `BOOKING_CREATED` to `event_logs`.

### `GET /api/dashboard/gantt?date=YYYY-MM-DD`
Returns:
```typescript
{
  date: string;
  rooms: Room[];           // all active rooms, sorted by sort_order
  bookings: Booking[];     // all bookings overlapping this date (±1 day buffer)
}
```
Overlap logic: a booking overlaps the queried date if `checkin_at < end_of_day AND checkout_at > start_of_day`.

---

## Part 4 — Detailed Screen Designs

---

### Screen 1 — Login (`/login`)

**Layout:** centered card, full-height page, dark or white depending on brand theme.

```
┌──────────────────────────────────┐
│                                  │
│       🏨 Every Inn               │
│       Admin Panel                │
│                                  │
│   Số điện thoại                  │
│   ┌──────────────────────────┐   │
│   │ 0901234567               │   │
│   └──────────────────────────┘   │
│                                  │
│   Mật khẩu                       │
│   ┌──────────────────────────┐   │
│   │ ••••••••           [👁] │   │
│   └──────────────────────────┘   │
│                                  │
│   ┌──────────────────────────┐   │
│   │       ĐĂNG NHẬP          │   │
│   └──────────────────────────┘   │
│                                  │
│   ⚠ Sai số điện thoại hoặc       │
│     mật khẩu                     │  ← shown only on error
└──────────────────────────────────┘
```

**Behavior:** On submit → `POST /api/auth/login` → redirect to `/dashboard`.

---

### Screen 2 — Dashboard (`/dashboard`) — Desktop

#### 2A. Full layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR                                                                       │
│  🏨 Every Inn Admin        [📅 Dashboard]  [➕ Đặt phòng]    [👤 Minh ▼]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ DATE NAV BAR                                                                 │
│  [← Hôm qua]    Thứ Tư, 24 tháng 9, 2026    [Ngày mai →]    [Hôm nay]     │
├─────────────┬────────────────────────────────────────────────────────────────┤
│ ROOM LABELS │  HOUR TIMELINE (0h → 23h)                     scrollable →   │
│  (fixed)    │                                                                │
│             │  0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18   │
├─────────────┼────────────────────────────────────────────────────────────────┤
│ Haven       │  │  │  │  │  │  │  │  │  │  │   │  │   │  │  ▓▓▓▓▓▓▓▓▓│   │
│ 101         │                                         [── Nguyễn V.A ─]    │
│ 🛏 20m² ·2👤│                                         Combo 3H 14–17h      │
├─────────────┼────────────────────────────────────────────────────────────────┤
│ Haven       │  ▓▓▓▓▓▓▓▓▓▓▓▓▓│  │  │  │  │  │  │  │   │  │   │  │  │   │  │
│ 201         │  [─ Trần T. B ─]                                              │
│ 🛏 20m² ·2👤│  Overnight 21h–9h hôm qua                                    │
├─────────────┼────────────────────────────────────────────────────────────────┤
│ Haven       │  │  │  │  │  │  │  │  │  │  │   │  │   │  │  │   │   │   │  │
│ 301         │  (trống)                                                      │
│ 🛏 20m² ·2👤│                                                               │
├─────────────┼────────────────────────────────────────────────────────────────┤
│ Signature   │  │  │  │  │  │  │  │  │  │  │   │  │   │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 102         │                                         [── Lê Văn C ──────]  │
│ ⭐ 28m² ·2👤│                                         Day Use 15h–12h+2h    │
├─────────────┼────────────────────────────────────────────────────────────────┤
│ Signature   │  │  │  │  │  │  │  │  │  │  │   │  │   │  │  │   │   │   │  │
│ 202         │  (trống)                                                      │
│ ⭐ 30m² ·2👤│                                                               │
├─────────────┼────────────────────────────────────────────────────────────────┤
│ Signature   │  │  │  │  │  │  │  │  │  │  │   │  │   │  │  │   │   │   │  │
│ 302         │  (trống)                                                      │
│ ⭐ 30m² ·2👤│                                                               │
└─────────────┴────────────────────────────────────────────────────────────────┘
                                         ↑ current time red vertical line
```

#### 2B. Gantt Layout Rules

- **Y-axis (left column)**: fixed position, does not scroll. Width ≈ 140px. Shows room name, icon, size, max guests.
- **X-axis (timeline)**: horizontal scroll only. 24 columns × 60px = 1440px total grid width. Current hour highlighted with a vertical red line.
- **Each booking bar**: absolutely positioned inside its row using `left = (checkinHour / 24 * 100%)`, `width = (durationHours / 24 * 100%)`. Height fills the row minus padding.
- **Bar label**: room name + guest name, truncated with ellipsis, shown if bar wide enough (>= 2h wide).
- **Overnight bookings crossing midnight**: rendered across the full row (21h–24h today block shown, and 0h–9h block shown). A thin connector line joins them.

#### 2C. Bar Color States

| Status | Color | Style |
|---|---|---|
| `confirmed` | Green `#22c55e` | Solid fill, white text |
| `pending` | Blue `#3b82f6` | Solid fill, white text |
| `holding` *(future)* | Amber `#f59e0b` | Animated pulse border |
| `cancelled` | Gray `#9ca3af` | Strikethrough text |

In MVP only `confirmed` is used. Others reserved.

#### 2D. Hover Tooltip

Appears on mouse-enter the bar (desktop only). Positioned above/below bar dynamically (avoid overflow).

```
┌─────────────────────────────────────┐
│  #EI-20260924-A3K9                  │
│  ─────────────────────────────────  │
│  🛏  Haven 101 · Combo 3H           │
│  📅  14:00 – 17:00  (3 giờ)        │
│  👤  Nguyễn Văn A · 0901234567      │
│  👥  2 khách                         │
│  💰  320,000đ  ✅ Xác nhận          │
│  ─────────────────────────────────  │
│  [✏️ Xem & sửa]                     │
└─────────────────────────────────────┘
```

#### 2E. Click Bar → Booking Detail Drawer

Slides in from the right. Overlay backdrop on mobile. On desktop: pushes/overlays the gantt.

```
┌────────────────────────────────────┐
│  Chi tiết đặt phòng          [✕]  │
├────────────────────────────────────┤
│  #EI-20260924-A3K9                 │
│  ✅ Xác nhận  ·  24/09/2026        │
├────────────────────────────────────┤
│  PHÒNG & THỜI GIAN                 │
│  🛏 Haven 101 · Tầng 1 · 20m²     │
│  Loại: Combo 3H                    │
│  Checkin:   14:00  Thứ Tư 24/09    │
│  Checkout:  17:00  Thứ Tư 24/09    │
│  Số khách:  2                      │
├────────────────────────────────────┤
│  KHÁCH HÀNG                        │
│  Họ tên    [Nguyễn Văn A       ]   │
│  Điện thoại [0901234567        ]   │
│  Ghi chú   [                   ]   │
│                    [💾 Lưu]        │
├────────────────────────────────────┤
│  GIÁ                               │
│  Combo 3H:         320,000đ        │
│  ────────────────────────          │
│  Tổng:             320,000đ        │
├────────────────────────────────────┤
│  🥈 Silver · 8 lần đặt · 3.2M đã  │
│     chi tiêu                       │
├────────────────────────────────────┤
│  Tạo bởi: Minh (LT) lúc 13:45     │
└────────────────────────────────────┘
```

**Fields in drawer:** name + note are editable → `PATCH /api/bookings/:id` (future endpoint). For MVP: show-only with "edit coming soon" label on those fields, or include edit now.

#### 2F. "Trống" (Empty) rows

Rows with no bookings show a subtle dashed/dotted pattern background with text "Trống" centered. Clicking anywhere on an empty row navigates to `/bookings/new?room_id=haven-101&date=2026-09-24`.

---

### Screen 2M — Dashboard Mobile

```
┌─────────────────────────────┐
│ 🏨 Every Inn Admin     [☰] │
├─────────────────────────────┤
│ [← 23/09] 24/09 Hôm nay [→]│
│ Thứ Tư, 24 tháng 9         │
│              [+ Đặt phòng]  │
├─────────────────────────────┤
│ 🛏 HAVEN 101  · 20m² · 2👤 │
│ ┌─────────────────────────┐ │
│ │ ✅  14:00 – 17:00       │ │
│ │ Nguyễn Văn A            │ │
│ │ Combo 3H · 320,000đ     │ │
│ │          [Xem chi tiết] │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ 🛏 HAVEN 201  · 20m² · 2👤 │
│ ┌─────────────────────────┐ │
│ │ ✅  21:00 hôm qua→09:00 │ │
│ │ Trần Thị B              │ │
│ │ Overnight · 490,000đ    │ │
│ │          [Xem chi tiết] │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ 🛏 HAVEN 301  · 20m² · 2👤 │
│ ✅ Trống cả ngày           │
│         [+ Đặt phòng này]  │
├─────────────────────────────┤
│ ⭐ SIGNATURE 102 · 28m²    │
│ ┌─────────────────────────┐ │
│ │ ✅  15:00 – 14:00+2h    │ │
│ │ Lê Văn C                │ │
│ │ Day Use · 810,000đ      │ │
│ │          [Xem chi tiết] │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ ⭐ SIGNATURE 202 · 30m²    │
│ ✅ Trống cả ngày           │
│         [+ Đặt phòng này]  │
├─────────────────────────────┤
│ ⭐ SIGNATURE 302 · 30m²    │
│ ✅ Trống cả ngày           │
│         [+ Đặt phòng này]  │
└─────────────────────────────┘
```

**Mobile "Xem chi tiết"** → opens the same `BookingDetailDrawer` as a bottom sheet (slides up from bottom, 90% height).

---

### Screen 3 — Create Booking (`/bookings/new`)

Single page, no wizard. Receptionist fills everything here. Sections collapse logically.

```
┌──────────────────────────────────────────────┐
│ ← Dashboard      Tạo đặt phòng mới          │
├──────────────────────────────────────────────┤
│                                              │
│  ── PHÒNG & THỜI GIAN ──────────────────    │
│                                              │
│  Phòng *                                     │
│  ┌────────────────────────────────────┐      │
│  │ Haven 101 — Tầng 1, 20m², 2 khách ▼│     │
│  └────────────────────────────────────┘      │
│  (grouped: Haven 101/201/301, Signature...)  │
│                                              │
│  Loại đặt phòng *                            │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐   │
│  │ ⏱ Theo  │ │ 🌙 Qua   │ │ ☀️ Phòng   │   │
│  │  Giờ    │ │  Đêm     │ │  Ngày      │   │
│  └──────────┘ └──────────┘ └────────────┘   │
│                                              │
│  ── IF "Theo Giờ" ─────────────────────     │
│  Ngày *                                      │
│  ┌────────────────────────────────────┐      │
│  │ 📅 24/09/2026                      │      │
│  └────────────────────────────────────┘      │
│                                              │
│  Giờ checkin *      Số giờ *                 │
│  ┌──────────────┐   ┌──────────────────┐    │
│  │ 14:00      ▼│   │ 3 giờ          ▼ │    │
│  └──────────────┘   └──────────────────┘    │
│  Checkin 09:00–21:00   Min 3h               │
│                                              │
│  Checkout: 17:00 (tự động)                  │
│                                              │
│  ── IF "Qua Đêm" ──────────────────────     │
│  Ngày checkin *                              │
│  ┌────────────────────────────────────┐      │
│  │ 📅 24/09/2026                      │      │
│  └────────────────────────────────────┘      │
│                                              │
│  Giờ bắt đầu *                              │
│  [21:00]  [22:00]  [23:00]  [00:00]         │
│  (segmented pill buttons)                   │
│                                              │
│  Checkout (tự động): 09:00, 25/09/2026      │
│                                              │
│  Giờ muộn thêm                              │
│  ┌──────────────┐  (+60,000đ/giờ)           │
│  │ 0 giờ      ▼│                            │
│  └──────────────┘                            │
│                                              │
│  ── IF "Phòng Ngày" ───────────────────     │
│  Ngày checkin *                              │
│  ┌────────────────────────────────────┐      │
│  │ 📅 24/09/2026                      │      │
│  └────────────────────────────────────┘      │
│                                              │
│  Số đêm *                                   │
│  [−]  1  [+]                                │
│  Checkin: 15:00 (cố định)                   │
│  Checkout: 12:00, 25/09 (cố định)           │
│                                              │
│  Giờ muộn thêm                              │
│  ┌──────────────┐  (+60,000đ/giờ)           │
│  │ 0 giờ      ▼│                            │
│  └──────────────┘                            │
│                                              │
│  ── THÔNG TIN KHÁCH ────────────────────    │
│                                              │
│  Số điện thoại *                             │
│  ┌──────────────────────────────┐ [🔍]      │
│  │ 0901234567                   │            │
│  └──────────────────────────────┘            │
│  ✅ Khách quen · 🥈 Silver · 8 lần đặt       │
│     Lần cuối: Haven 201 · 10/09/2026         │
│                                              │
│  Họ và tên *                                 │
│  ┌────────────────────────────────────┐      │
│  │ Nguyễn Văn A  (tự động điền)       │      │
│  └────────────────────────────────────┘      │
│                                              │
│  Số khách *                                  │
│  [−]  2  [+]  (tối đa 2)                   │
│                                              │
│  Ghi chú                                     │
│  ┌────────────────────────────────────┐      │
│  │                                    │      │
│  └────────────────────────────────────┘      │
│                                              │
│  ── TỔNG TIỀN ──────────────────────────    │
│  ┌────────────────────────────────────┐      │
│  │ Combo 3H:             320,000đ     │      │
│  │ ──────────────────────────────     │      │
│  │ TỔNG:                 320,000đ     │      │
│  └────────────────────────────────────┘      │
│  (live update as fields change)              │
│                                              │
├──────────────────────────────────────────────┤
│  [Hủy — về Dashboard]  [✅ Tạo đặt phòng]   │
└──────────────────────────────────────────────┘
```

**CDP phone lookup behavior:**
- On tap 🔍 icon or on blur (leaving the phone field): `GET /api/members/:phone`
- **Found** → auto-fill name field, show green badge: `✅ Khách quen · 🥈 Silver · 8 lần đặt · Lần cuối: ...`
- **Not found** → show info: `ℹ️ Số mới — hồ sơ sẽ được tạo khi lưu`
- Name field stays editable in both cases

**Price summary card — live calculation:**
Updates whenever `booking_type`, `checkin_at`, `checkout_at`, `room_id`, or `late_checkout_hours` changes. Uses same `calcTotal()` logic from `lib/pricing.ts`.

**Submit → `POST /api/bookings`:**
1. Validate all required fields
2. Call API → creates booking, upserts member (CDP), writes audit log
3. Success → redirect to `/dashboard` with toast: `✅ Đã tạo đặt phòng #EI-20260924-A3K9`
4. Error → inline error message

---

## Part 5 — Business Logic Specs

### `lib/pricing.ts` — `calcTotal()`
```typescript
type CalcInput = {
  bookingType: 'hourly' | 'overnight' | 'dayuse';
  roomClass: 'haven' | 'signature';
  checkinAt: Date;
  checkoutAt: Date;
  lateCheckoutHours: number;
  pricingRules: PricingRule[];  // from DB
};

function resolveCombo(hours: number): { comboKey: 'combo3h'|'combo6h', extraHours: number } {
  if (hours <= 3) return { comboKey: 'combo3h', extraHours: hours - 3 };   // no negative, min 3h
  if (hours <= 6) return { comboKey: 'combo6h', extraHours: hours - 6 };
  return { comboKey: 'combo6h', extraHours: hours - 6 };
}

function calcTotal(input: CalcInput): { basePriceKey, basePrice, extraFee, total } {
  const extraHourFee = 60_000;

  if (input.bookingType === 'hourly') {
    const hours = (checkoutAt - checkinAt) / 3_600_000;
    const { comboKey, extraHours } = resolveCombo(hours);
    const basePrice = getPriceFromRules(roomClass, comboKey);
    const extraFee = Math.max(0, extraHours) * extraHourFee;
    return { basePriceKey: comboKey, basePrice, extraFee, total: basePrice + extraFee };
  }

  if (input.bookingType === 'overnight') {
    const basePrice = getPriceFromRules(roomClass, 'overnight');
    const extraFee = lateCheckoutHours * extraHourFee;
    return { basePriceKey: 'overnight', basePrice, extraFee, total: basePrice + extraFee };
  }

  if (input.bookingType === 'dayuse') {
    const nights = calcNights(checkinAt, checkoutAt);  // based on 15:00 blocks
    const basePrice = getPriceFromRules(roomClass, 'dayroom') * nights;
    const extraFee = lateCheckoutHours * extraHourFee;
    return { basePriceKey: 'dayroom', basePrice, extraFee, total: basePrice + extraFee };
  }
}
```

### `lib/cdp.ts` — `upsertMember()`
```typescript
async function upsertMember(db, { phone, name, booking }) {
  const existing = await db.getMember(phone);
  const isNights = ['overnight', 'dayuse'].includes(booking.bookingType);
  const nightsToAdd = isNights ? (booking.bookingType === 'dayuse' ? calcNights(...) : 1) : 0;
  const newSpent = (existing?.total_spent ?? 0) + booking.totalPrice;
  const newBookings = (existing?.total_bookings ?? 0) + 1;
  const newTier = calcTier(newSpent, newBookings);

  if (!existing) {
    await db.createMember({ phone, name, ...stats, loyalty_tier: newTier });
    await logEvent('MEMBER_CREATED', ...);
  } else {
    await db.updateMember(phone, { name, ...updatedStats, loyalty_tier: newTier });
    if (newTier !== existing.loyalty_tier)
      await logEvent('MEMBER_TIER_CHANGED', { from: existing.loyalty_tier, to: newTier });
  }
}

function calcTier(spent: number, bookings: number): string {
  if (bookings >= 10 || spent >= 8_000_000) return 'gold';
  if (bookings >= 5  || spent >= 3_000_000) return 'silver';
  if (bookings >= 1  || spent >= 500_000)   return 'bronze';
  return 'new';
}
```

---

## Part 6 — Execution Checklist

### 🙋 USER must do (with agent guiding each step):

- [ ] **U-1** Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
- [ ] **U-2** Create D1 database: `Workers & Pages → D1 → Create → name: everyinn-admin` → copy **Database ID**
- [ ] **U-3** Run `npx wrangler login` in terminal when prompted
- [ ] **U-4** Provide Database ID to agent (paste when asked)
- [ ] **U-5** Run these commands (agent provides exact values to enter):
  ```bash
  npx wrangler secret put SESSION_SECRET
  ```
  *(Telegram secrets added in future phase when Telegram feature is built)*
- [ ] **U-6** Run: `npm run db:migrate && npm run db:seed`
- [ ] **U-7** Run: `npm run deploy`

### 🤖 AGENT does (agent executes all of these):

- **A1** Scaffold project with `npx create-next-app@latest`
- **A2** Install deps: `@opennextjs/cloudflare wrangler bcryptjs @types/bcryptjs`
- **A3** Write `wrangler.jsonc` with D1 binding (placeholder for DB ID)
- **A4** Write `db/migrations/001_tables.sql` + `002_seed.sql`
- **A5** Write `db/seed.ts` script (bcrypt hash manager password, run migrations)
- **A6** Write `package.json` scripts: `db:migrate`, `db:seed`, `dev`, `deploy`
- **A7** Write all `src/lib/*.ts` utilities
- **A8** Write all API route handlers
- **A9** Build all UI components
- **A10** Wire up all pages + auth middleware

---

## Definition of Done (MVP)

**Dashboard:**
- [ ] Login works with seeded manager account
- [ ] Dashboard loads all 6 rooms on correct date
- [ ] Available rooms show empty row with "Trống" background + "+ Đặt phòng" shortcut on click
- [ ] Confirmed bookings show as correctly-positioned green bars on the timeline
- [ ] Bar label shows guest name (truncated if needed)
- [ ] Current-hour red line visible
- [ ] Overnight bookings spanning past midnight render correctly
- [ ] Hover shows tooltip with booking info
- [ ] Click bar opens Booking Detail Drawer with correct data
- [ ] Date navigation (prev/next/today) reloads gantt data correctly
- [ ] Mobile view shows room cards with booking chips

**Create Booking:**
- [ ] All 3 booking type tabs work with correct sub-fields
- [ ] Hourly: checkin 09:00–21:00, min 3h enforced in duration dropdown
- [ ] Overnight: segmented start time, auto checkout, late checkout stepper
- [ ] Day Use: nights stepper, fixed times, late checkout stepper
- [ ] Phone lookup: auto-fills name + shows loyalty badge if member found
- [ ] Phone lookup: shows "Khách mới" message if not found
- [ ] Price summary updates live as fields change
- [ ] Submit creates booking, upserts CDP member, logs audit event
- [ ] Redirect to dashboard with success toast after submit
