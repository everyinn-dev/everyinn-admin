# Every Inn Admin Panel — System Context & Agent Knowledge

> **Project Origin**: Paired session in Conversation ID: `b233f8ba-37b9-44b5-81ac-8ab7da3127dc`  
> **Documentation**: See [`docs/implementation_plan.md`](file:///Users/lap14666/Documents/private/every%20inn/van%20hanh/booking-page/everyinn-admin/docs/implementation_plan.md) for full architectural specs, wireframes, and roadmap.

---

## 🏨 1. Project Overview & Business Purpose
This repository is the **Internal Admin Panel** for **Every Inn Vạn Hạnh** (397/24 Sư Vạn Hạnh, P.12, Q.10, TP.HCM).
It is designed exclusively for hotel **receptionists and managers** to:
1. View real-time room availability via a 24-hour visual Gantt timeline chart (`/dashboard`).
2. Rapidly book rooms for walk-in or phone-in guests on a single streamlined form (`/bookings/new`).
3. Leverage an integrated **Mini CDP (Customer Data Platform)**:
   - Entering a phone number auto-detects returning guests, displays their loyalty tier and total spend/bookings, and auto-fills their name.
   - Creating any booking automatically upserts the member's profile and recalculates their loyalty tier.

---

## 🛠️ 2. Technology Stack & Deployment
- **Framework**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Runtime & Deployment**: Cloudflare Workers via `@opennextjs/cloudflare` + `wrangler`
- **Database**: Cloudflare D1 (SQLite) with local & remote migrations
- **Session Auth**: Password hashing with `bcryptjs`, HttpOnly session cookies stored in `staff_sessions` table
- **Build / Deploy Commands**:
  - `npm run dev` — Run local Next.js dev server with local D1 context
  - `npm run db:migrate:local` — Execute tables migration on local D1 SQLite
  - `npm run db:seed:local` — Seed master data into local D1 SQLite
  - `npm run db:migrate:remote` — Execute tables migration on Cloudflare D1 (Production)
  - `npm run db:seed:remote` — Seed master data into Cloudflare D1 (Production)
  - `npm run deploy` — Build OpenNext worker and deploy to Cloudflare

---

## 🗄️ 3. Database Schema Overview (D1 SQLite)
Migrations are located in `db/migrations/`:
- `001_tables.sql`: Core schema (properties, rooms, pricing_rules, configs, staff, members, bookings, room_blocks, event_logs).
- `002_seed.sql`: Seed data for property, default rooms, pricing rules, configs, and default staff.
- `003_refactor_rooms_pricing.sql`: 6 rooms total (3 Haven: 101, 201, 301 | 3 Signature: 102, 202, 302) and standard pricing.
- `004_add_config_hourly_slots.sql`: Adds `hourly_checkin_slots` config (`[21, 22, 23, 24]`) to `configs` table.
- `005_import_sheet_bookings.sql`: Historical bookings imported from operational Google Sheet.
- `006_add_social_and_closing_note.sql`: Adds `instagram`, `facebook` to `members` & `bookings`, and `closing_note` to `bookings`.

---

## ⚡ 3.1. Master Data In-Process Caching (`src/lib/cache.ts` & `src/lib/masterData.ts`)
To optimize Cloudflare D1 query quota and accelerate latency:
- Master data is cached in-memory at module scope (`Map` with TTL = 60 minutes):
  - `master:rooms`: Active rooms list (`getCachedRooms`)
  - `master:pricing_rules`: Active pricing table (`getCachedPricingRules`)
  - `master:booking_rules`: Check-in hours, late checkout limits, extra fees (`getCachedBookingRules`)
  - `master:cdp_tiers`: Spend & booking thresholds for Bronze/Silver/Gold (`getCachedCdpTiers`)
  - `master:hourly_slots`: Allowed overnight check-in hours (`getCachedHourlySlots`)
- **Cache Invalidation**:
  - Automatically resets whenever a new Worker instance spins up or code deploys via GitHub.
  - Automatically expires after 60-minute TTL.
  - Manual invalidation via `POST /api/admin/cache/clear` (Manager role only).
- **Transactional Data**: `bookings`, `members`, `room_blocks`, and `staff_sessions` are ALWAYS read fresh from D1.

---

## 📐 4. Business & Pricing Formulas (`src/lib/pricing.ts`)
- **Phụ phí giờ thêm**: 60.000đ / giờ (thêm tối đa 2 giờ).
- **1. Theo Giờ (Hourly)**:
  - Khung giờ nhận: **09:00 đến 21:00** (sau 21:00 tính là Qua Đêm).
  - Khối đặt tối thiểu: **Combo 3 Giờ** (Haven: 320k, Signature: 360k).
  - Khối 6 Giờ: **Combo 6 Giờ** (Haven: 600k, Signature: 640k).
  - Phụ trội: 60k / giờ (thêm tối đa 2 giờ).
- **2. Qua Đêm (Overnight)**:
  - Khung giờ nhận: **21:00 đến 24:00 (00:00)**.
  - Tiêu chuẩn: **21:00 - 09:00 hôm sau** (12 tiếng).
  - Giá gốc: Haven 490k, Signature 620k.
  - Trả phòng trễ (Late checkout): Tối đa 2 tiếng (+60k/h).
- **3. Theo Ngày (Day Use)**:
  - Nhận phòng tiêu chuẩn: **15:00** — Trả phòng: **12:00** hôm sau.
  - Giá gốc: Haven 590k/đêm, Signature 750k/đêm.
  - Trả phòng trễ: Tối đa 2 tiếng (+60k/h).
- **4. Tuỳ Chỉnh (Custom)**:
  - Dành cho đơn thỏa thuận đặc biệt (chụp ảnh, quay phim, thuê dài ngày, đơn đối tác).
  - Tự chọn ngày giờ check-in & check-out bất kỳ.
  - Tự nhập số tiền thanh toán (customPrice).

---

## 👤 5. Mini CDP & Loyalty Tiers (`src/lib/cdp.ts`)
- `gold`: Tổng đặt ≥ 10 lần HOẶC Tổng chi tiêu ≥ 8.000.000đ
- `silver`: Tổng đặt ≥ 5 lần HOẶC Tổng chi tiêu ≥ 3.000.000đ
- `bronze`: Tổng đặt ≥ 1 lần HOẶC Tổng chi tiêu ≥ 500.000đ
- `new`: Khách hàng mới

---

## 🔑 6. Default Login Credentials
- **Quản lý (Manager)**: SĐT: `0901234567` — Mật khẩu: `everyinn2024`
- **Lễ tân (Receptionist)**: SĐT: `0909998888` — Mật khẩu: `everyinn2024`

---

## 🗺️ 7. Current Project State & Roadmap
- **Phase 1 (Completed ✅)**:
  - D1 database migrations & local seed
  - Staff authentication & session handling
  - Visual 24h room timeline dashboard (`/dashboard`)
  - Create booking form (`/bookings/new`) with Mini CDP phone auto-lookup & live price breakdown
  - Bookings history list (`/bookings`)
  - Centralized booking overlap & 1h turnover cleaning buffer validator (`src/lib/validators.ts`)
  - Gantt chart visual turnover buffer bars (1h after checkout, amber dashed) on desktop & mobile
  - Inline booking editing & +1h checkout in `BookingDetailDrawer`
  - Floating Toast Notification System (`src/components/ui/Toast`) with slide-in-from-right animation, auto-dismiss timer bar, pause-on-hover, and contextual themes (Success, Warning/Validation, System Error, Info)
  - Verified OpenNext Cloudflare bundle build
- **Phase 2 (Upcoming)**:
  - 5-minute temporary room hold timer
  - QR Code payment generation & manual confirmation toggle
  - Telegram bot notifications (TG-01 through TG-05)
  - 6-digit door code generation

---

## 🛡️ 8. Cloudflare Free Tier Infrastructure Constraints & Algorithmic Guardrails
> **Target Platform**: Cloudflare Workers + Cloudflare D1 (SQLite at the Edge)  
> **Source Reference**: [Cloudflare Developer Documentation](https://developers.cloudflare.com/) (Workers Limits, D1 Platform Limits)  
> **Detailed Rule File**: See [`.agents/rules/cloudflare-free-tier.md`](file:///Users/lap14666/Documents/private/every%20inn/van%20hanh/booking-page/everyinn-admin/.agents/rules/cloudflare-free-tier.md)

Khi viết code và thiết kế thuật toán cho hệ thống, TẤT CẢ các agent và lập trình viên **BẮT BUỘC** phải tuân thủ các quy tắc sau nhằm đảm bảo hệ thống chạy mượt mà trên giới hạn gói Free:

### 1. Giới hạn Cơ sở dữ liệu D1 (D1 Quota Protection)
- **5.000.000 Rows Read / ngày**:
  - D1 tính quota theo **số dòng bị quét (Rows Read)**, KHÔNG phải số câu lệnh.
  - **Zero-Unindexed Scans**: CẤM quét toàn bảng (`table scan`). Mọi câu lệnh SQL có `WHERE`, `ORDER BY`, `JOIN` trên bảng `bookings`, `members`, `room_blocks`, `staff_sessions` BẮT BUỘC phải dùng `INDEX`.
  - **Selective Projection**: CẤM dùng `SELECT *` trong các API thông thường; chỉ `SELECT` các cột cần thiết để giảm tải I/O và bộ nhớ.
  - **Phân trang bắt buộc**: Mọi API danh sách phải có `LIMIT` (mặc định $\le 50$) và phân trang, tránh kéo hàng ngàn bản ghi một lúc.
- **100.000 Rows Written / ngày**:
  - Tránh `UPDATE` thừa thãi khi dữ liệu không thay đổi.
  - **Gom thao tác qua `db.batch()`**: Khi 1 nghiệp vụ cần ghi nhiều bảng (Tạo booking + Cập nhật tổng chi tiêu/hạng thẻ Member + Ghi Event Log), BẮT BUỘC dùng `await db.batch([stmt1, stmt2, stmt3])` để gói gọn trong 1 transaction và 1 round-trip duy nhất.

### 2. Giới hạn Cloudflare Workers (Worker CPU & Memory Guard)
- **10 ms CPU Time / request**:
  - 10ms là thời gian tính toán thực tế của CPU, không tính thời gian chờ mạng.
  - **Cảnh báo Bcrypt**: Thư viện `bcryptjs` ngốn rất nhiều CPU. Salt rounds $\ge 12$ sẽ làm sập Worker ngay lập tức (`Error 1101: CPU limit exceeded`). CHỈ dùng tối đa `bcrypt.genSalt(10)` hoặc Web Crypto API (`crypto.subtle`).
  - **Giải thuật Tuyến Tính**: Mọi hàm biến đổi dữ liệu trên Worker phải là $O(N)$ hoặc $O(N \log N)$. CẤM vòng lặp lồng $O(N^2)$ hoặc $O(N^3)$.
- **128 MB Memory / Isolate**:
  - Không đọc toàn bộ dataset lớn vào bộ nhớ. Tránh rò rỉ bộ nhớ trong các biến toàn cục module.
- **Worker Phi Trạng Thái (Stateless & Ephemeral)**:
  - Isolate có thể bị hủy và tái tạo bất kỳ lúc nào trên 300+ data centers.
  - `src/lib/cache.ts` CHỈ dùng để cache Master Data (Rooms, Pricing Rules, CDP Tiers) để giảm D1 rows read.
  - CẤM dùng biến trong bộ nhớ module để làm "Khóa giữ phòng" (Hold Lock) hoặc biến đồng bộ trạng thái giao dịch. Trạng thái giữ phòng phải lưu vào cột `hold_expires_at` của bảng `bookings` trong D1.
  - CẤM dùng `setTimeout` chạy ngầm sau khi trả Response (Worker sẽ bị đóng băng ngay lập tức).
- **100.000 Requests / ngày**:
  - Frontend polling / refresh phải có khoảng nghỉ tối thiểu $\ge 30$ giây. Không polling 1s - 5s.
  - Tìm kiếm SĐT phải có Debounce (300ms - 500ms) trên client.
- **50 Subrequests / request**:
  - Giới hạn số lần gọi API ngoài (Telegram, VietQR, Zalo) tối đa 1-3 lần/request, có try/catch và timeout $\le 5000$ms.

