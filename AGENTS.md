# Every Inn Admin Panel — System Context & Agent Knowledge Base (Neural Architecture Map)

> 🚦 **READ FIRST — cross-agent source of truth**: [`../everyinn-platform-docs/EI_PHASE1_STATUS.md`](../everyinn-platform-docs/EI_PHASE1_STATUS.md) (sibling repo `everyinn-platform-docs`)
> Deploy state, Cloudflare resource IDs, the Admin route migration map (CORE vs LEGACY SQL), the task board and open owner decisions live **only** there.
> Do not duplicate that information here. Update it before ending any session that changes anything.

> **Project Origin**: Every Inn Phan Xch Long (Ph Nhuận, TP. Hồ Ch Minh)  
> **Master Roadmap & Backlog**: [`docs/project_status_and_backlog.md`](file:///Users/lap14666/Documents/private/every%20inn/van%20hanh/booking-page/everyinn-admin/docs/project_status_and_backlog.md)  
> **Original Specs**: [`docs/implementation_plan.md`](file:///Users/lap14666/Documents/private/every%20inn/van%20hanh/booking-page/everyinn-admin/docs/implementation_plan.md)  
> **Infrastructure Rules**: [`.agents/rules/cloudflare-free-tier.md`](file:///Users/lap14666/Documents/private/every%20inn/van%20hanh/booking-page/everyinn-admin/.agents/rules/cloudflare-free-tier.md)  
> **Agent / MCP Index**: [`.agents/README.md`](file:///Users/lap14666/Documents/private/every%20inn/van%20hanh/booking-page/everyinn-admin/.agents/README.md)

---

## 🧠 SỨ MỆNH TÀI LIỆU (NEURAL ARCHITECTURE PHILOSOPHY)
Tài liệu này là **Single Source of Truth** và **Hệ Nơ-ron Liên Kết (Neural Graph)** dành cho các AI Models (Claude, GPT, Gemini, DeepSeek, Cursor) và Lập trình viên.
- **Tiết kiệm Token & Thời gian**: KHÔNG quét mù toàn bộ cây thư mục (`find`, `grep` bừa bãi). Hãy tra cứu các mắc xích trong tài liệu này để định vị chính xác File, Function, Bảng SQL và State liên quan.
- **Tính Nhất Quán Tuyệt Đối (Codebase Convention)**: Mọi model tiếp quản dự án đều tuân thủ cùng một quy chuẩn kiến trúc, quy tắc Cloudflare Free Tier và logic nghiệp vụ khách sạn.

---

## 🛠️ 1. CÔNG NGHỆ & LỆNH THAO TÁC CƠ SỞ (STACK & RUNTIME)

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS v4.
- **Runtime & Deployment**: Cloudflare Workers qua `@opennextjs/cloudflare` + `wrangler`.
  - Production Worker: `everyinn-admin` (branch `main`)
  - UAT Worker: `everyinn-admin-dev` (branch `dev`)
  - CD Deployment: Cloudflare Workers Builds (tự động build/deploy khi push/merge vào `dev` hoặc `main`).
- **Database**: Cloudflare D1 (Staff & Audit only trong kiến trúc Core Service Bindings).
  - Dev: `admin-db-dev` (`be3b4c8a-117f-401b-8e11-ed1c7786d459`), migrations: `db/admin-db`
  - Prod: `admin-db-prod` (staff & audit only)
- **Service Bindings**:
  - `BOOKING_CORE`: `everyinn-booking-core-dev` (UAT) / `everyinn-booking-core` (Prod)
  - `CDP_CORE`: `everyinn-cdp-core-dev` (UAT) / `everyinn-cdp-core` (Prod)
- **Session Auth**: 1-Day Stateless JWT Cookie (`everyinn_admin_session`) ký bằng Web Crypto API (`crypto.subtle` HS256) qua `JWT_SECRET` (fail-closed nếu thiếu secret).

### Danh mục lệnh chuẩn hóa:
```bash
# Khởi động môi trường phát triển & kiểm tra
npm run dev                    # Chạy dev server Next.js với local context
npm run lint                   # Kiểm tra ESLint
npm test                       # Chạy unit tests (JWT fail-closed & signing)
npm run cf-typegen             # Đồng bộ Cloudflare binding types vào env.d.ts khi đổi wrangler bindings
npm run preview                # Build OpenNext worker và chạy preview local theo runtime Cloudflare

# Di trú D1 Migrations (dùng wrangler d1 migrations apply)
npm run db:migrate:local       # Di trú D1 SQLite Local
npm run db:migrate:dev         # Di trú D1 Remote môi trường Dev (admin-db-dev)
npm run db:migrate:prod        # Di trú D1 Remote môi trường Production

# Cloudflare Workers Builds
npm run cf:build               # Gate: lint && tsc && opennextjs-cloudflare build
npm run cf:deploy              # Deploy Production Worker (chạy bởi Cloudflare Workers Builds trên branch main)
npm run cf:deploy:dev          # Deploy UAT Worker (chạy bởi Cloudflare Workers Builds trên branch dev)
```

---

## 🗄️ 2. MẮC XÍCH DATABASE D1 (SCHEMA, INDEXES & RELATIONS)

### 2.1. Bản Đồ Các Bảng (Database Tables)
1. `properties`: Thông tin khách sạn (Phan Xích Long), hotline, địa chỉ, tài khoản ngân hàng VietQR.
2. `rooms`: 6 phòng vật lý (3 Haven: 101, 201, 301 | 3 Signature: 102, 202, 302).
3. `pricing_rules`: Bảng giá cấu hình (Combo 3h, 6h, Qua đêm, Theo ngày cho từng hạng phòng).
4. `configs`: Cấu hình hệ thống JSON (`booking_rules`, `cdp_tiers`, `hourly_checkin_slots`).
5. `staff`: Tài khoản nhân sự (`role`: `manager` | `receptionist`), mật khẩu bcryptjs salt <= 10; fallback session UUID legacy vẫn đọc/xóa qua bảng `staff_sessions` trong `src/lib/auth.ts`.
6. `members`: Mini CDP khách hàng (SĐT, Họ tên, `total_spent`, `total_bookings`, `loyalty_tier`, `no_show_count`, Instagram, Facebook).
7. `bookings`: Giao dịch đặt phòng. Lưu trữ toàn diện thời gian, giá, tiền cọc, ưu đãi, mã cửa, trạng thái.
8. `room_blocks`: Khóa phòng bảo trì / sửa chữa tạm thời theo phòng và khung giờ.
9. `event_logs`: Nhật ký kiểm toán (Audit Trail) và **Con trỏ ETag 304** toàn hệ thống.
10. `promotion_categories`: Danh mục khuyến mãi (`seasonal`, `loyalty`, `special`).
11. `promotions`: Chương trình ưu đãi giảm % hoặc VND kèm điều kiện ràng buộc động.

### 2.2. Ma Trận Chỉ Mục B-Tree Bắt Buộc (Index Matrix — Zero Table Scans)
Mọi câu truy vấn có `WHERE` hoặc `ORDER BY` BẮT BUỘC dùng Index để bảo vệ Quota 5M rows read/ngày:
| Tên Bảng | Tên Index | Các Cột Chỉ Mục | Mục Đích Truy Vấn |
|---|---|---|---|
| `bookings` | `idx_bookings_room_dates` | `(room_id, checkin_at, checkout_at)` | Quét xung đột phòng & vẽ Gantt theo phòng |
| `bookings` | `idx_bookings_member_phone` | `(member_phone)` | Tra cứu lịch sử khách hàng Mini CDP |
| `bookings` | `idx_bookings_date` | `(checkin_at, checkout_at)` | Lấy dữ liệu Gantt đa phòng theo ngày |
| `bookings` | `idx_bookings_created_at` | `(created_at DESC)` | Phân trang danh sách đặt phòng `/bookings` |
| `bookings` | `idx_bookings_status_checkin`| `(status, checkin_at)` | Lọc danh sách No-show & Checkin trong ngày |
| `bookings` | `idx_bookings_deposit_due` | `(is_deposit, deposit_status, deposit_due_date)` | Popup & Polling nhắc cọc đến hạn |
| `bookings` | `idx_bookings_deposit_status`| `(deposit_status)` | Lọc trạng thái cọc (`pending`, `partial`, `paid`) |
| `members` | `idx_members_phone` | `(phone)` (UNIQUE) | Tra cứu nhanh 1 dòng khách quen theo SĐT |
| `room_blocks`| `idx_room_blocks_room_date` | `(room_id, start_at, end_at)` | Lấy khối bảo trì trên Gantt & kiểm tra xung đột |
| `event_logs` | `idx_event_logs_created` | `(created_at DESC)` | Kiểm toán & lấy `MAX(id)` cho ETag 304 |
| `promotions` | `idx_promotions_code` | `(code)` | Tra cứu mã khuyến mãi |

---

## ⚡ 3. MẮC XÍCH THƯ VIỆN NGHIỆP VỤ (`src/lib/` NEURAL FUNCTIONS)

Mọi logic nghiệp vụ cốt lõi đều được đóng gói độc lập trong `src/lib/`. AI Models chỉ cần import đúng hàm:

```
src/lib/
├── db.ts             ──> Khởi tạo D1 binding (getDb) & batch operations
├── jwt.ts            ──> Ký & kiểm tra Stateless JWT HS256 (Web Crypto API)
├── auth.ts           ──> Lấy phiên đăng nhập hiện tại từ cookie (getCurrentStaff)
├── cache.ts          ──> In-memory Map cache cho Master data (TTL 60 phút), invalidate key/prefix
├── masterData.ts     ──> Nạp & cache Rooms, Pricing, Booking Rules, CDP Tiers, Hourly Slots, Promotions
├── pricing.ts        ──> Tính giá tự động: Combo 3h/6h, Đêm, Ngày, Custom, Giờ thêm
├── promotions.ts     ──> Đánh giá hợp lệ & tính chiết khấu khuyến mãi động
├── validators.ts     ──> Kiểm tra xung đột lịch & Buffer 1h dọn phòng bắt buộc
├── timelineUtils.ts  ──> 48 slot 30 phút, roundToNearest30Min, khóa giờ quá khứ
├── cdp.ts            ──> Upsert khách hàng, tính lại hạng thẻ theo tiền thực thu
├── bookingId.ts      ──> Sinh mã đơn đặt phòng (EI + timestamp + random)
├── audit.ts          ──> Ghi log kiểm toán (logEvent, getLogEventStatement)
└── syncEvents.ts     ──> Đồng bộ đa tab tức thì qua Web BroadcastChannel API
```

### Chi tiết các hàm trọng yếu:
- **`src/lib/pricing.ts`**:
  - `calculatePrice(params)`: Trả về `PricingBreakdown` chi tiết (giá gốc, combo, phụ trội, giảm giá, tổng cộng).
  - `resolveHourlyCombo(hours)`: Quyết định Combo 3 Giờ hay Combo 6 Giờ và số giờ phụ trội.
- **`src/lib/promotions.ts`**:
  - `validatePromotionEligibility(promotion, context)`: Kiểm tra 8 điều kiện (Active, Lượt dùng, Thời hạn, Thứ trong tuần, Hạng phòng, Loại đặt, Hạng thành viên, Đơn tối thiểu).
  - `computePromotionDiscount(promotion, rawSubtotal)`: Tính tiền giảm (% hoặc cố định VND, chặn trần `max_discount_amount`).
- **`src/lib/validators.ts`**:
  - `checkBookingOverlapWithBuffer(db, slot, roomName)`: Kiểm tra va chạm trực tiếp và cưỡng chế **60 phút đệm dọn phòng** sau checkout và trước checkin kế tiếp.
- **`src/lib/timelineUtils.ts`**:
  - `TIME_SLOTS_30MIN`: 48 mốc thời gian tiêu chuẩn (`00:00` đến `23:30`).
  - `roundToNearest30Min(timeInput)`: Làm tròn về mốc `:00` hoặc `:30` gần nhất.
  - `roundUpToNext30Min(date)`: Làm tròn tiến lên mốc tiếp theo (mặc định cho form tạo đơn).
  - `isPastTimeSlot(dateStr, timeStr)`: Trả về `true` nếu mốc thời gian đã qua trong ngày (UTC+7).
- **`src/lib/cache.ts`**:
  - `getOrSet(key, ttlSeconds, fetcher)`: Cache in-memory theo key cho các API master data.
  - `invalidatePrefix(prefix)`: Xóa cache theo namespace như `master:` hoặc `dashboard:gantt:`.
- **`src/lib/masterData.ts`**:
  - `getCachedRooms`, `getCachedPricingRules`, `getCachedBookingRules`, `getCachedCdpTiers`, `getCachedHourlySlots`: Chuẩn đọc master data qua cache TTL 3600s.
  - `getCachedPromotionCategories`, `getCachedActivePromotions`: Cache dữ liệu ưu đãi đang hoạt động cho form và màn quản trị.
  - `invalidatePromotionsCache()` / `invalidateAllMasterCache()`: Điểm chuẩn để xóa cache `master:*` sau mutation.
- **`src/lib/cdp.ts`**:
  - `calculateLoyaltyTier(spent, bookings, tiers)`: Tính hạng `gold`, `silver`, `bronze`, `new`.
  - `upsertMemberOnBooking(...)`: Tạo mới hoặc cập nhật khách, tích lũy tiền thực thu và số đêm.
  - `recalculateMemberStats(db, phone)`: Quét lại toàn bộ đơn hợp lệ để tính chuẩn lại số liệu khi có Hủy phòng/No-Show.
- **`src/lib/bookingId.ts`**:
  - `generateBookingId(date?)`: Sinh mã dạng `EI-YYYYMMDD-XXXX`, loại bỏ ký tự dễ nhầm `I`, `O`, `1`, `0`.
- **`src/lib/syncEvents.ts`**:
  - `notifyDataChanged("BOOKINGS_CHANGED")`: Bắn tín hiệu sang các tab khác qua `BroadcastChannel`.
  - `subscribeToSyncEvents(callback)`: Lắng nghe sự kiện để revalidate UI không cần reload.

---

## 🌐 4. MẮC XÍCH API ROUTES (`src/app/api/`)

| Đường Dẫn (Endpoint) | Method | File Xử Lý | Bảng D1 Tương Tác | Ghi Chú & ETag / Cache |
|---|---|---|---|---|
| `/api/auth/login` | `POST` | `src/app/api/auth/login/route.ts` | `staff` | Trả Cookie JWT `everyinn_admin_session` |
| `/api/auth/logout` | `POST` | `src/app/api/auth/logout/route.ts` | - | Xóa cookie phiên |
| `/api/auth/me` | `GET` | `src/app/api/auth/me/route.ts` | `staff` | Trả thông tin nhân viên hiện tại |
| `/api/rooms` | `GET` | `src/app/api/rooms/route.ts` | `rooms` | Danh sách phòng active, cache public `max-age=300`, đọc qua `getCachedRooms` |
| `/api/pricing-rules` | `GET` | `src/app/api/pricing-rules/route.ts` | `pricing_rules` | Danh sách biểu phí active, cache public `max-age=300`, đọc qua `getCachedPricingRules` |
| `/api/configs` | `GET` | `src/app/api/configs/route.ts` | `configs` | Trả gộp `bookingRules`, `hourlySlots`, `cdpTiers` từ master cache |
| `/api/staff` | `GET` | `src/app/api/staff/route.ts` | `staff` | Danh sách nhân sự active cho filter/dropdown, yêu cầu đăng nhập, `Cache-Control: private, no-store` |
| `/api/dashboard/gantt` | `GET` | `src/app/api/dashboard/gantt/route.ts` | `bookings`, `room_blocks`, `rooms` | **ETag 304** dựa trên `MAX(event_logs.id)` |
| `/api/bookings` | `GET` | `src/app/api/bookings/route.ts` | `bookings`, `rooms` | Danh sách lịch sử, phân trang, lọc đa chiều, **ETag 304** |
| `/api/bookings` | `POST` | `src/app/api/bookings/route.ts` | `bookings`, `members`, `event_logs`, `promotions` | Tạo đơn mới, snapshot giá/cọc/ưu đãi, cập nhật Mini CDP, tăng `used_count` promo, invalidate `dashboard:gantt:` cache |
| `/api/bookings/[id]` | `GET` | `src/app/api/bookings/[id]/route.ts` | `bookings` | Xem chi tiết 1 đơn |
| `/api/bookings/[id]` | `PATCH` | `src/app/api/bookings/[id]/route.ts` | `bookings`, `members`, `event_logs` | Sửa giờ, +1h trả trễ, thu nốt cọc, đánh dấu no-show |
| `/api/bookings/[id]` | `DELETE` | `src/app/api/bookings/[id]/route.ts` | `bookings`, `members`, `event_logs` | Hủy đặt phòng (Hard delete), rollback CDP |
| `/api/bookings/deposit-reminders` | `GET` | `.../deposit-reminders/route.ts` | `bookings` | Lấy danh sách đơn đến hạn nhắc cọc, **ETag 304** |
| `/api/bookings/daily-roster` | `GET` | `.../daily-roster/route.ts` | `bookings`, `rooms` | Thống kê lượt khách In/Out/Stayover trong ngày |
| `/api/members/[phone]` | `GET` | `src/app/api/members/[phone]/route.ts`| `members` | Phone auto-lookup Mini CDP |
| `/api/room-blocks` | `GET/POST`| `src/app/api/room-blocks/route.ts` | `room_blocks`, `event_logs` | Lấy & tạo khối khóa phòng bảo trì |
| `/api/room-blocks/[id]` | `DELETE` | `src/app/api/room-blocks/[id]/route.ts`| `room_blocks`, `event_logs` | Mở khóa phòng bảo trì 1-click |
| `/api/promotions` | `GET/POST`| `src/app/api/promotions/route.ts` | `promotions`, `promotion_categories` | Danh sách & tạo khuyến mãi mới |
| `/api/promotions/[id]` | `PATCH/DEL`| `.../promotions/[id]/route.ts` | `promotions` | Sửa & xóa/tắt khuyến mãi |
| `/api/promotions/categories` | `GET/POST`| `.../categories/route.ts` | `promotion_categories` | Quản lý danh mục ưu đãi |
| `/api/promotions/validate` | `POST` | `.../validate/route.ts` | `promotions` | Đánh giá tính hợp lệ của mã ưu đãi |
| `/api/admin/cache/clear` | `POST` | `src/app/api/admin/cache/clear/route.ts`| In-memory Cache | Xóa sạch in-memory master data cache |

---

## 🖥️ 5. MẮC XÍCH GIAO DIỆN & CÂY COMPONENT (UI HIERARCHY)

```
src/app/
├── layout.tsx                ──> Root HTML, ToastProvider, Font Inter
├── page.tsx                  ──> Chuyển hướng về /dashboard hoặc /login
├── login/page.tsx            ──> Form đăng nhập SĐT & Password
├── dashboard/page.tsx        ──> [MÀN HÌNH CHÍNH] Bảng phòng 24h Gantt
│   ├── DateNavBar            ──> Thanh điều hướng ngày (Hôm nay, +/- 1 ngày, Chọn ngày)
│   ├── GanttChart            ──> Lưới Gantt Desktop (19 slots/ngày)
│   │   ├── GanttRoomRow      ──> Dòng của từng phòng (101..302)
│   │   ├── GanttBar          ──> Thanh đặt phòng gradient, huy hiệu Cọc/Đủ
│   │   └── TurnoverBufferBar ──> Vạch đệm dọn phòng 1h cam viền đứt
│   ├── MobileVerticalGantt   ──> Giao diện Gantt dọc chuyên biệt cho điện thoại
│   ├── BookingDetailDrawer   ──> Drawer chi tiết: Xem, Sửa, +1h, Thu cọc nốt, No-show, Hủy
│   ├── RoomLockModal         ──> Modal khóa phòng bảo trì (48 slot 30p)
│   ├── RoomLockDetailDrawer  ──> Drawer thông tin khóa phòng & nút Mở khóa
│   ├── DailyRosterModal      ──> Modal tổng kết danh sách khách trong ca/ngày
│   └── DepositReminderModal  ──> Popup tự động nhắc cọc đến hạn/quá hạn
├── bookings/
│   ├── page.tsx              ──> [DANH SÁCH ĐẶT PHÒNG] Tra cứu lịch sử
│   │   └── BookingsListClient──> State, Debounce Search, Filter Bar, Pagination Table
│   └── new/page.tsx          ──> [FORM TẠO ĐƠN NHANH] Đặt phòng 1 trang
│       └── BookingForm       ──> State trung tâm, tính giá live
│           ├── PhoneLookupField  ──> Tra cứu SĐT, tự điền tên, hiện hạng thẻ CDP
│           ├── BookingTypeTabs   ──> Chọn loại: Giờ | Đêm | Ngày | Tuỳ Chỉnh
│           ├── HourlyFields / OvernightFields / DayUseFields / CustomFields
│           ├── DepositSection    ──> Chọn cọc (50%/tùy ý), hẹn ngày trả đủ
│           ├── PromotionSelector ──> Áp dụng mã ưu đãi phù hợp điều kiện
│           └── PriceSummaryCard  ──> Tóm tắt chi phí, cọc, giảm giá, nút Submit
└── promotions/page.tsx       ──> [QUẢN TRỊ ƯU ĐÃI] Quản lý Danh mục & Chương trình
    ├── CategoriesList & CategoryModal   ──> CRUD danh mục ưu đãi
    └── PromotionsList & PromotionModal ──> CRUD khuyến mãi & ràng buộc điều kiện
```

---

## 📐 6. QUY CHUẨN CODE & THIẾT KẾ BẮT BUỘC (CODING CONVENTIONS)

Mọi code sinh ra hoặc chỉnh sửa **BẮT BUỘC** tuân thủ các quy tắc sau:

### 1. Chuẩn Hóa Thời Gian 30 Phút (30-Minute Standard)
- Không dùng phút lẻ (`14:15`, `14:27`) hay `<input type="time">` tự do.
- Luôn dùng `TIME_SLOTS_30MIN` từ `src/lib/timelineUtils.ts` cho các dropdown chọn giờ.
- Các slot trong quá khứ so với giờ hiện tại (UTC+7) trên cùng ngày phải bị `disabled`.

### 2. Chuẩn Quản Lý Tiền Cọc & Thu Phần Còn Lại
- `is_deposit = 1`: Đơn có đặt cọc.
- `deposit_amount`: Số tiền cọc quy định ban đầu.
- `paid_amount`: Số tiền **thực tế khách đã thanh toán** đến thời điểm hiện tại.
- `remaining_amount = total_price - paid_amount`: Số tiền còn thiếu.
- `deposit_status`:
  - `'pending'`: Chưa đóng đồng nào.
  - `'partial'`: Đã đóng 1 phần (cọc).
  - `'paid'`: Đã thanh toán đủ 100%.
- **Mini CDP**: Chỉ cộng tích lũy chi tiêu `total_spent` dựa trên **tiền thực thu (`paid_amount`)**, không cộng trên tổng giá đơn chưa thu đủ.

### 3. Chuẩn Phân Định Hủy Phòng (Cancel) vs No-Show
- **Hủy Đơn (Cancel)**:
  - Hành vi: Hard delete (`DELETE FROM bookings WHERE id = ?`).
  - D1 Action: Xóa đơn, gọi `recalculateMemberStats` để hoàn tác số liệu CDP, ghi event `BOOKING_CANCELLED`.
- **No-Show (Khách không đến / Vi phạm)**:
  - Hành vi: Soft status (`status = 'no_show'`).
  - D1 Action: Giữ nguyên đơn, giải phóng phòng trên Gantt, cập nhật `refund_amount`, `original_price`, `no_show_reason`, cộng `no_show_count + 1` của Member.

### 4. Chuẩn Giao Diện (Tailwind CSS v4 & Notification)
- Theme màu chủ đạo: Tối sang trọng (`bg-slate-950`, `bg-slate-900`, `border-slate-800`, `text-slate-100`).
- Màu nhấn nghiệp vụ:
  - **Amber (`amber-400`, `amber-500`)**: Thương hiệu, vạch dọn phòng, sọc bảo trì.
  - **Emerald (`emerald-500`)**: Đã thanh toán đủ, hoàn thành, nút submit.
  - **Purple (`purple-500`, `purple-400`)**: Trạng thái No-Show, ưu đãi VIP.
  - **Sky / Blue (`blue-500`)**: Khách quen Mini CDP, loại đặt Theo Ngày.
- Thông báo: **CẤM** dùng `window.alert()` hay `window.confirm()`. Luôn dùng hook `useToast()` (`toast.success()`, `toast.error()`, `toast.warning()`).

### 5. Chuẩn Bảo Vệ Quota Cloudflare D1
- Mọi mutation ghi nhiều bảng BẮT BUỘC dùng `await db.batch([stmt1, stmt2, stmt3])`.
- Sau khi ghi dữ liệu thành công, luôn gọi `notifyDataChanged("BOOKINGS_CHANGED")` và ghi `logEvent()` vào `event_logs` để ETag 304 kích hoạt.
- Master data read APIs (`/api/rooms`, `/api/pricing-rules`, `/api/configs`) dùng cache `getOrSet()` với key prefix `master:`; khi mutation vào promotions hoặc master data, xóa cache bằng `invalidatePromotionsCache()`, `invalidatePrefix("master:")` hoặc `POST /api/admin/cache/clear`.

---

## ⚡ 7. BẢNG TRA CỨU MẮC XÍCH NHANH (FAST NEURAL LOOKUP)

Khi được yêu cầu làm một tác vụ, **TRA CỨU NGAY BẢNG NÀY** để mở đúng file mà không cần scan:

| Yêu Cầu Cần Thực Hiện | File Cần Mở / Sửa | Hàm / Component Chính | Bảng D1 / API Liên Quan |
|---|---|---|---|
| **Sửa công thức tính giá / Combo / Giờ thêm** | `src/lib/pricing.ts` | `calculatePrice`, `resolveHourlyCombo` | `pricing_rules`, `/api/pricing-rules` |
| **Sửa đệm 1h dọn phòng hoặc kiểm tra va chạm**| `src/lib/validators.ts` | `checkBookingOverlapWithBuffer` | `bookings`, `room_blocks` |
| **Sửa giao diện Gantt timeline / Vạch phòng** | `src/components/dashboard/GanttChart.tsx`, `GanttBar.tsx` | `GanttBar`, `TurnoverBufferBar` | `/api/dashboard/gantt` |
| **Sửa Drawer chi tiết đơn / Nút +1h / Thu cọc** | `src/components/dashboard/BookingDetailDrawer.tsx` | `BookingDetailDrawer` | `/api/bookings/[id]` |
| **Sửa Popup nhắc cọc / Logic Snooze** | `src/components/bookings/DepositReminderModal.tsx` | `DepositReminderModal` | `/api/bookings/deposit-reminders` |
| **Sửa Form tạo đặt phòng / Nhập cọc** | `src/components/bookings/BookingForm.tsx`, `DepositSection.tsx`| `BookingForm`, `DepositSection` | `POST /api/bookings` |
| **Sửa Tra cứu SĐT / Hạng thẻ Mini CDP** | `src/lib/cdp.ts`, `PhoneLookupField.tsx` | `lookupMember`, `upsertMemberOnBooking` | `members`, `/api/members/[phone]` |
| **Sửa Khóa phòng bảo trì (Room Lock)** | `src/components/dashboard/RoomLockModal.tsx` | `RoomLockModal` | `room_blocks`, `/api/room-blocks` |
| **Sửa Khuyến mãi / Đánh giá ưu đãi** | `src/lib/promotions.ts`, `PromotionSelector.tsx` | `validatePromotionEligibility`, `computePromotionDiscount` | `promotions`, `/api/promotions` |
| **Sửa master data phòng / giá / cấu hình** | `src/lib/masterData.ts`, `src/app/api/{rooms,pricing-rules,configs}/route.ts` | `getCachedRooms`, `getCachedPricingRules`, `getCachedBookingRules`, `getCachedCdpTiers`, `getCachedHourlySlots` | `rooms`, `pricing_rules`, `configs` |
| **Sửa cache hệ thống / xóa cache master** | `src/lib/cache.ts`, `src/app/api/admin/cache/clear/route.ts` | `getOrSet`, `invalidatePrefix`, `invalidateAllMasterCache` | `master:*`, `/api/admin/cache/clear` |
| **Sửa Bộ lọc & Phân trang danh sách đặt phòng** | `src/app/bookings/_components/BookingsListClient.tsx` | `BookingsListClient`, `BookingsFilterBar` | `GET /api/bookings` |
| **Sửa dropdown/filter nhân sự active** | `src/app/api/staff/route.ts` | `GET /api/staff` | `staff` |
| **Sửa Lịch trực hàng ngày (Daily Roster)** | `src/components/bookings/DailyRosterModal.tsx` | `DailyRosterModal` | `/api/bookings/daily-roster` |
| **Triển khai Backlog tiếp theo (Hold/QR/Bot)** | `docs/project_status_and_backlog.md` | Xem mã Task (TASK-01 đến TASK-12) | Xem chi tiết trong Backlog |
