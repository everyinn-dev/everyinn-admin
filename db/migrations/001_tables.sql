-- ── MASTER DATA ─────────────────────────────────

CREATE TABLE IF NOT EXISTS properties (
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

CREATE TABLE IF NOT EXISTS rooms (
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
  updated_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id    TEXT NOT NULL,
  room_class     TEXT NOT NULL,
  booking_type   TEXT NOT NULL,         -- "combo3h"|"combo6h"|"overnight"|"dayroom"
  base_price     INTEGER NOT NULL,
  extra_hour_fee INTEGER DEFAULT 60000,
  is_active      INTEGER DEFAULT 1,
  created_at     TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE TABLE IF NOT EXISTS configs (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,            -- JSON-encoded
  description TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ── STAFF ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff (
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

CREATE TABLE IF NOT EXISTS staff_sessions (
  token      TEXT PRIMARY KEY,
  staff_id   INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- ── CDP ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS members (
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
CREATE INDEX IF NOT EXISTS idx_members_tier ON members(loyalty_tier);

-- ── BOOKINGS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookings (
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

  -- Status (MVP: confirmed or pending)
  status               TEXT DEFAULT 'confirmed',

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
  public_token         TEXT UNIQUE,
  cancelled_at         TEXT,
  cancel_reason        TEXT,
  cancelled_by         INTEGER,

  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (created_by_staff_id) REFERENCES staff(id)
);
CREATE INDEX IF NOT EXISTS idx_bookings_status    ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_member    ON bookings(member_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings(room_id, checkin_at, checkout_at);

-- ── ROOM BLOCKS (Maintenance / Admin Hold) ─────

CREATE TABLE IF NOT EXISTS room_blocks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id     TEXT NOT NULL,
  blocked_from TEXT NOT NULL,
  blocked_to   TEXT NOT NULL,
  reason      TEXT,
  created_by  INTEGER,
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- ── AUDIT LOG ───────────────────────────────────

CREATE TABLE IF NOT EXISTS event_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  payload    TEXT NOT NULL,
  staff_id   INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_entity ON event_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_type   ON event_logs(event_type);
