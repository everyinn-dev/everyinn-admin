# Every Inn Admin Panel — Tiến Độ Dự Án, Tính Năng Bổ Sung & Master Backlog

> **Phiên bản tài liệu**: `2.0.0`  
> **Cập nhật ngày**: `09/10/2026`  
> **Mục đích**: Tài liệu hóa toàn diện tiến độ triển khai so với bản thiết kế ban đầu ([`docs/implementation_plan.md`](./implementation_plan.md)), ghi nhận đầy đủ các tính năng đã phát triển mở rộng, và thiết lập **Master Backlog** chuẩn hóa đa tương thích (Multi-Model Compatible) để bất kỳ mô hình AI (Claude, GPT, Gemini, DeepSeek, v.v.) hoặc lập trình viên nào cũng có thể đọc hiểu và thực thi tiếp tục mà không bị đứt đoạn ngữ cảnh.

---

## 🏛️ PHẦN 1: TỔNG QUAN KIẾN TRÚC & QUY CHUẨN KỸ THUẬT BẮT BUỘC

### 1. Công nghệ & Hạ tầng triển khai
- **Frontend & App Engine**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS v4.
- **Runtime & Hosting**: Cloudflare Workers qua `@opennextjs/cloudflare` + `wrangler`.
- **Cơ sở dữ liệu**: Cloudflare D1 (SQLite at the Edge) — Database ID: `2518bd3e-5479-4b03-afb1-3ab28d7e3e7e`.
- **Cơ chế xác thực (Auth)**: 1-Day Stateless JWT Cookie HS256 ký bằng native Web Crypto API (`crypto.subtle`) — loại bỏ hoàn toàn việc đọc bảng `staff_sessions` trong D1 mỗi request.

### 2. Quy chuẩn bất biến toàn hệ thống (System Guardrails)
Mọi AI model hoặc lập trình viên khi viết code cho dự án **BẮT BUỘC TUÂN THỦ**:
1. **Chuẩn hóa bước thời gian 30 phút (30-Minute Time Step)**:
   - Tuyệt đối **KHÔNG** dùng input giờ phút tự do. Mọi thao tác chọn thời gian bắt buộc dùng 48 slot tiêu chuẩn: `00:00, 00:30, ..., 23:30` (`TIME_SLOTS_30MIN`).
   - Mọi mốc thời gian trong quá khứ so với giờ hiện tại (UTC+7) phải bị vô hiệu hóa (`disabled`).
2. **Bảo vệ Quota Cloudflare Free Tier (5M Reads/ngày, 100k Writes/ngày, 10ms CPU/req)**:
   - **Zero-Unindexed Scans**: CẤM quét toàn bảng (`table scan`). Mọi câu lệnh SQL có `WHERE`, `ORDER BY`, `JOIN` trên `bookings`, `members`, `room_blocks` bắt buộc có B-Tree Index hỗ trợ.
   - **Selective Projection**: Không dùng `SELECT *` trong các API tần suất cao; chỉ `SELECT` các cột cần thiết.
   - **ETag 304 Version-Checking**: Các API danh sách (`/api/bookings`, `/api/dashboard/gantt`, `/api/bookings/deposit-reminders`) phải kiểm tra `SELECT COALESCE(MAX(id), 0) FROM event_logs`. Nếu không có event mới, server trả ngay `HTTP 304 Not Modified` (0 bytes payload, 1 D1 row read).
   - **Đồng bộ thời gian thực**: Sử dụng `BroadcastChannel("everyinn_sync_channel")` trên client (0ms latency, 0 request mạng) kết hợp `visibilitychange`/`window.focus`.
   - **Gom ghi dữ liệu**: Sử dụng `await db.batch([stmt1, stmt2, ...])` để gói gọn nhiều thao tác ghi vào 1 transaction duy nhất.

---

## 📊 PHẦN 2: BẢNG SO SÁNH TIẾN ĐỘ THỰC TẾ VS KẾ HOẠCH BAN ĐẦU

| Hạng mục / Tính năng | Kế hoạch ban đầu ([`implementation_plan.md`](./implementation_plan.md)) | Trạng thái hiện tại | Ghi chú & Đánh giá |
|---|---|---|---|
| **Đăng nhập nhân sự (Staff Login)** | MVP (SĐT + Pass) | **Hoàn thành 100% ✅** | Nâng cấp lên Stateless JWT HS256 (`src/lib/jwt.ts`). |
| **Bảng phòng trực quan (24h Gantt)** | MVP (Timeline lưới 6 phòng) | **Hoàn thành 100% ✅** | Hỗ trợ Desktop Gantt + Mobile Vertical Gantt chuyên biệt. |
| **Tạo đặt phòng mới (`/bookings/new`)** | MVP (Giờ, Đêm, Ngày) | **Hoàn thành 100% ✅** | Bổ sung thêm loại hình **Tuỳ Chỉnh (Custom)** và bộ chọn ưu đãi. |
| **Mini CDP: Phone auto-lookup** | MVP (Tra cứu SĐT khách) | **Hoàn thành 100% ✅** | Nhận diện khách quen, hạng thẻ, lịch sử lần cuối, mạng xã hội. |
| **Mini CDP: Tích lũy chi tiêu & Hạng thẻ** | MVP (Upsert khi tạo đơn) | **Hoàn thành 100% ✅** | Chuẩn hóa theo tiền thực thu (Realized Cash), hỗ trợ thăng/hạ hạng. |
| **Buffer dọn phòng (1h Turnover Buffer)** | MVP (Ngầm định) | **Hoàn thành 100% ✅** | Kiểm tra va chạm tập trung + hiển thị vạch dọn phòng cam đứt nét. |
| **Danh sách đặt phòng (`/bookings`)** | *Chưa có trong kế hoạch MVP* | **Hoàn thành 100% ✅** | **ĐÃ PHÁT TRIỂN MỞ RỘNG**: Phân trang, tìm kiếm, lọc đa chiều. |
| **Khóa phòng bảo trì (Room Lock)** | *Chưa có trong kế hoạch MVP* | **Hoàn thành 100% ✅** | **ĐÃ PHÁT TRIỂN MỞ RỘNG**: Modal khóa phòng + họa tiết sọc chéo. |
| **Quản lý Đặt cọc & Nhắc cọc tự động** | *Chưa có trong kế hoạch MVP* | **Hoàn thành 100% ✅** | **ĐÃ PHÁT TRIỂN MỞ RỘNG**: Cọc 50%/tùy ý, hẹn ngày, popup nhắc nhở. |
| **Quản lý Ưu đãi & Khuyến mãi (`/promotions`)** | Ghi chú tương lai | **Hoàn thành 100% ✅** | **ĐÃ PHÁT TRIỂN MỞ RỘNG**: CRUD danh mục & ưu đãi mùa/thành viên. |
| **Xử lý No-Show vs Hủy phòng** | Ghi chú tương lai | **Hoàn thành 100% ✅** | **ĐÃ PHÁT TRIỂN MỞ RỘNG**: No-Show giữ phòng / hoàn tiền + Rollback CDP. |
| **Gia hạn giờ (+1h Trả trễ)** | Ghi chú tương lai | **Hoàn thành 100% ✅** | **ĐÃ PHÁT TRIỂN MỞ RỘNG**: Nút 1-click kiểm tra lịch kế tiếp. |
| **Bảng lịch trực hàng ngày (`Daily Roster`)** | *Chưa có trong kế hoạch MVP* | **Hoàn thành 100% ✅** | **ĐÃ PHÁT TRIỂN MỞ RỘNG**: Modal xem nhanh lượt khách trong ngày. |
| **Khóa giữ phòng 5 phút (5-min Hold)** | Kế hoạch tương lai | **Chưa triển khai ⏳** | Nằm trong **Backlog Epic 1**. |
| **Tạo mã VietQR động & Đối soát** | Kế hoạch tương lai | **Chưa triển khai ⏳** | Nằm trong **Backlog Epic 2**. |
| **Thông báo Telegram Bot (TG-01..05)** | Kế hoạch tương lai | **Chưa triển khai ⏳** | Nằm trong **Backlog Epic 3**. |
| **Sinh mã khóa cửa 6 chữ số (Door Code)** | Kế hoạch tương lai | **Chưa triển khai ⏳** | Nằm trong **Backlog Epic 4**. |
| **Màn hình Cấu hình Bảng giá (`/settings`)** | Kế hoạch tương lai | **Chưa triển khai ⏳** | Nằm trong **Backlog Epic 5**. |
| **Guest Portal tra cứu (`/view/:token`)** | Kế hoạch tương lai | **Chưa triển khai ⏳** | Nằm trong **Backlog Epic 6**. |

---

## 🛠️ PHẦN 3: CHI TIẾT CÁC TÍNH NĂNG ĐÃ BỔ SUNG & PHÁT TRIỂN MỞ RỘNG

Hệ thống hiện tại đã vượt xa phạm vi MVP 2 màn hình ban đầu. Dưới đây là các module mở rộng đã hoàn thiện và đang hoạt động ổn định:

### 1. Quản lý Đặt cọc & Nhắc nhở Thu tiền Phần còn lại (Deposit Management)
- **Cơ sở dữ liệu**: Migration `012_add_deposit_management.sql`. Các cột: `is_deposit`, `deposit_amount`, `paid_amount`, `remaining_amount`, `deposit_due_date`, `deposit_status`, `deposit_paid_at`, `deposit_reminder_sent_at`, `deposit_reminder_sent_by`, `remaining_paid_at`, `remaining_paid_by`.
- **Chỉ mục B-Tree**: `idx_bookings_deposit_due(is_deposit, deposit_status, deposit_due_date)`, `idx_bookings_deposit_status(deposit_status)`.
- **Giao diện**:
  - `src/components/bookings/DepositSection.tsx`: Giao diện chọn cọc khi tạo đơn, gợi ý nhanh 50%, 30%, hoặc tự nhập. Hẹn ngày trả đủ ("Trước 1 ngày check-in", "Ngày check-in", hoặc ngày tự chọn).
  - `src/components/bookings/DepositReminderModal.tsx`: Popup tự động hiển thị giữa màn hình khi có đơn đến hạn/quá hạn thu cọc. Có nút Hoãn (Snooze 15p, 1h), nút "Đã gửi nhắc cọc" (loại trừ nhắc trong ngày), nút "Xem & Thu Tiền" (1-click mở thẳng drawer thu tiền).
  - `src/components/dashboard/BookingDetailDrawer.tsx`: Nút "Bổ Sung Thanh Toán Phần Còn Lại", cho phép thu từng đợt hoặc thu nốt 100%, ghi nhật ký và audit log.
  - `src/components/dashboard/GanttBar.tsx`: Huy hiệu `🪙 Cọc` / `🪙 Đủ` trên timeline.

### 2. Quản lý Danh mục & Chương trình Ưu đãi Động (`/promotions`)
- **Cơ sở dữ liệu**: Migration `011_promotions_and_categories.sql`. Bảng `promotion_categories`, bảng `promotions`, các cột `promotion_id`, `promotion_code` trong bảng `bookings`.
- **Giao diện & Logic**:
  - Trang quản trị `/promotions` quản lý CRUD danh mục (Theo mùa, Hạng thành viên, Đặc biệt) và các chương trình khuyến mãi.
  - Hỗ trợ giảm theo % (có hạn mức trần `max_discount_amount`) hoặc số tiền cố định VND.
  - Ràng buộc linh hoạt: Đơn tối thiểu, Hạng phòng áp dụng, Loại hình đặt áp dụng, Hạng thành viên áp dụng (New, Bronze, Silver, Gold), Thứ trong tuần (T2..CN), Khoảng ngày hiệu lực, Giới hạn lượt dùng.
  - Bộ chọn ưu đãi `PromotionSelector.tsx` trên form tạo đơn tự động đánh giá điều kiện (`evaluatePromotion`) và hiển thị thông báo lỗi nếu không hợp lệ.

### 3. Nghiệp vụ Khóa Phòng Bảo Trì / Sửa Chữa (Room Lock & Maintenance)
- **Cơ sở dữ liệu**: Bảng `room_blocks` (Migration `001`, `007`, `008`). Cột `note`, index `idx_room_blocks_room_date`.
- **Giao diện**:
  - `src/components/dashboard/RoomLockModal.tsx`: Chọn phòng, ngày bắt đầu/kết thúc, giờ khóa/mở (theo 48 slot 30 phút), lý do bảo trì.
  - `src/components/dashboard/RoomLockDetailDrawer.tsx`: Xem thông tin khóa phòng và mở khóa 1-click.
  - Hiển thị nổi bật bằng họa tiết sọc chéo bảo trì (amber hazard stripes) trên timeline Desktop & Mobile, tự động ghi đè giờ dọn phòng.

### 4. Danh Sách Đặt Phòng Tra Cứu Đa Chiều (`/bookings`)
- **Giao diện & Logic**:
  - `src/app/bookings/page.tsx` & `_components/BookingsListClient.tsx`.
  - Phân trang tự động (20 dòng/trang).
  - Tìm kiếm Debounce (350ms, >= 3 ký tự) tìm theo SĐT, Tên khách, Instagram, Facebook, Mã đặt phòng.
  - Bộ lọc kết hợp: Trạng thái đơn, Trạng thái cọc, Phòng, Loại hình đặt, Người tạo, Ngày tạo.
  - Sắp xếp đa cột (Checkin, Checkout, Tổng tiền, Ngày tạo).
  - Hỗ trợ URL Param `search` & `autoOpen=true` để mở thẳng drawer từ các màn hình khác.

### 5. Nghiệp vụ Phân Định Hủy Phòng (Cancel) vs No-Show (Khách Không Đến)
- **Cancel (Hủy đặt phòng)**:
  - Hard delete (`DELETE FROM bookings WHERE id = ?`).
  - Tự động hoàn tác số liệu CDP của thành viên (`total_bookings - 1`, `total_spent - paid_amount`, `total_nights`, tính lại hạng thẻ).
- **No-Show (Khách không đến / Hủy vi phạm quy định)**:
  - Soft status (`status = 'no_show'`).
  - Phòng lập tức giải phóng trên Gantt để đón khách mới.
  - Lưu trữ `no_show_at`, `no_show_by`, `no_show_reason`, `refund_amount`, `original_price`.
  - Tự động cộng `no_show_count + 1` của khách trong Mini CDP.
  - Tính toán số tiền hoàn và doanh thu giữ lại chuẩn xác dựa trên số tiền thực thu (`actualCashReceived`).

### 6. Thống Kê Lịch Trực Hàng Ngày (Daily Roster Modal)
- `src/components/bookings/DailyRosterModal.tsx`: Xem tổng quan phân loại khách Check-in, Check-out và Khách đang lưu trú (Stay-over) trong ngày, thống kê nhanh công suất phòng và doanh thu dự kiến.

---

## 📌 PHẦN 4: MASTER BACKLOG CHI TIẾT (KẾ HOẠCH HOÀN THIỆN)

Backlog dưới đây được cấu trúc theo 6 Epics, sắp xếp theo mức độ ưu tiên từ cao xuống thấp. Mỗi task được viết dưới dạng đặc tả kỹ thuật độc lập để bất kỳ AI model nào cũng có thể đọc và triển khai chuẩn xác.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BẢN ĐỒ LỘ TRÌNH BACKLOG                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  EPIC 1: Khóa Giữ Phòng Tạm Thời 5 Phút (Hold Timer)         [ƯU TIÊN CAO]  │
│  EPIC 2: Tích Hợp VietQR Động & Xác Nhận Thanh Toán         [ƯU TIÊN CAO]  │
│  EPIC 3: Hệ Thống Thông Báo Telegram Bot Tự Động (TG-01..05) [ƯU TIÊN VỪA]  │
│  EPIC 4: Sinh Mã Cửa 6 Chữ Số & Cú Pháp Nhận Phòng           [ƯU TIÊN VỪA]  │
│  EPIC 5: Giao Diện Quản Trị Cấu Hình Bảng Giá & Nhân Sự      [ƯU TIÊN VỪA]  │
│  EPIC 6: Guest View Portal Công Khai (/view/:publicToken)    [ƯU TIÊN THẤP] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🟢 EPIC 1: KHÓA GIỮ PHÒNG TẠM THỜI 5 PHÚT (HOLD TIMER)
> **Mục đích nghiệp vụ**: Khi lễ tân nhận điện thoại hoặc khách đang quét mã chuyển khoản, lễ tân bấm "Giữ phòng tạm 5 phút" để tránh nhân viên khác hoặc ca khác đặt đè lên phòng đó trong lúc chờ xác nhận.

#### TASK-01: Backend API Khóa Giữ Phòng & Tự Động Hết Hạn
- **Files**:
  - `src/app/api/bookings/route.ts`
  - `src/lib/validators.ts`
- **Mô tả kỹ thuật**:
  - API `POST /api/bookings` hỗ trợ tham số `status: 'holding'`.
  - Khi `status === 'holding'`, tự động gán `hold_expires_at = datetime('now', '+5 minutes')`.
  - Trong `src/lib/validators.ts` (`checkBookingOverlapWithBuffer`):
    - Đơn có `status = 'holding'` CHỈ tính là va chạm lịch NẾU `datetime('now') < hold_expires_at`.
    - Nếu `hold_expires_at <= datetime('now')`, validator tự động coi như phòng đã giải phóng (không bị chặn đặt đè).
    - **Guardrail**: KHÔNG dùng `setTimeout` chạy ngầm (Worker stateless). Việc giải phóng phòng hoàn toàn dựa vào điều kiện thời gian của SQL và Validator.
- **Tiêu chí nghiệm thu (DoD)**:
  - Đơn holding tự hết hiệu lực sau 5 phút tính toán theo thời gian máy chủ.
  - Event log ghi nhận `BOOKING_HOLD_CREATED`.

#### TASK-02: Giao Diện Timeline Gantt & Đồng Hồ Đếm Ngược 5 Phút
- **Files**:
  - `src/components/dashboard/GanttBar.tsx`
  - `src/components/dashboard/BookingDetailDrawer.tsx`
  - `src/components/bookings/BookingForm.tsx`
- **Mô tả kỹ thuật**:
  - Trên timeline Gantt: Đơn holding hiển thị thanh màu vàng/tím viền nét đứt kèm hiệu ứng pulse động và biểu tượng `⏳ Đang giữ phòng (MM:SS)`.
  - Client component tính toán thời gian còn lại: `Math.max(0, Math.floor((new Date(booking.holdExpiresAt).getTime() - Date.now()) / 1000))`.
  - Trong `BookingDetailDrawer`: Có nút **"Xác nhận đặt chính thức"** (chuyển status thành `confirmed`, xóa `hold_expires_at`) và nút **"Hủy giữ phòng ngay"**.
  - Khi đồng hồ về 0, thanh holding tự mờ đi hoặc biến mất khi có revalidation.
- **Tiêu chí nghiệm thu (DoD)**:
  - Đồng hồ đếm ngược mượt mà từng giây.
  - Chuyển trạng thái sang `confirmed` thành công và cập nhật lại giao diện không cần reload trang.

---

### 🟢 EPIC 2: TÍCH HỢP VIETQR ĐỘNG & XÁC NHẬN THANH TOÁN
> **Mục đích nghiệp vụ**: Thay vì đưa số tài khoản thủ công, hệ thống tự sinh mã QR VietQR chuẩn NAPAS chứa sẵn số tiền (tiền cọc hoặc toàn bộ tiền phòng) và mã đơn đặt phòng để khách quét chuyển khoản tức thì không nhầm lẫn.

#### TASK-03: Tiện Ích Sinh Mã QR VietQR Động
- **Files**:
  - `src/lib/vietqr.ts` (Tạo mới)
  - `src/types/index.ts`
- **Mô tả kỹ thuật**:
  - Tạo hàm `generateVietQrUrl({ bankId, accountNo, accountName, amount, memo })`:
    - Sử dụng chuẩn URL VietQR:
      `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(accountName)}`
    - Lấy thông tin tài khoản từ bảng `properties` (`bank_id`, `bank_account`, `bank_holder_name`).
    - Quy chuẩn nội dung chuyển khoản (`memo`): `EI <ID_ĐƠN> <SĐT>` (Ví dụ: `EI EI20261009A1B2 0901234567`).
- **Tiêu chí nghiệm thu (DoD)**:
  - Trả về URL ảnh QR hợp lệ, quét thử trên app ngân hàng nhận diện đúng ngân hàng, số tiền và nội dung.

#### TASK-04: Modal / Drawer Quét Mã VietQR & Toggle Xác Nhận Thanh Toán
- **Files**:
  - `src/components/bookings/VietQrModal.tsx` (Tạo mới)
  - `src/components/bookings/PriceSummaryCard.tsx`
  - `src/components/dashboard/BookingDetailDrawer.tsx`
  - `src/app/api/bookings/[id]/route.ts`
- **Mô tả kỹ thuật**:
  - Thêm action `confirm_payment` vào `PATCH /api/bookings/[id]`:
    - Cập nhật `payment_confirmed_at = datetime('now')`, `payment_confirmed_by = staff.id`.
    - Ghi log audit `BOOKING_PAYMENT_CONFIRMED`.
  - Trên `PriceSummaryCard` và `BookingDetailDrawer`:
    - Nút **"📱 Mã QR Thanh Toán"**: Mở modal hiển thị mã QR cỡ lớn kèm nút copy STK, Số tiền, Nội dung.
    - Cho phép chọn: Quét tiền cọc (nếu là đơn cọc) HOẶC Quét tổng tiền phòng.
    - Nút gạt hoặc nút bấm **"Xác nhận đã nhận tiền"**: Đánh dấu thanh toán thành công và hiện dấu tích xanh.
- **Tiêu chí nghiệm thu (DoD)**:
  - Nhân viên bấm xem QR được bất kỳ lúc nào; xác nhận thanh toán lưu đúng nhân viên và thời điểm.

---

### 🟡 EPIC 3: HỆ THỐNG THÔNG BÁO TELEGRAM BOT TỰ ĐỘNG (TG-01 ĐẾN TG-05)
> **Mục đích nghiệp vụ**: Thông báo tức thì cho ban quản lý và nhóm chat vận hành mỗi khi có phát sinh đặt phòng, nhắc nợ cọc đầu ca, cảnh báo hủy phòng/No-Show hoặc báo cáo doanh thu cuối ngày.

#### TASK-05: Tiện Ích Gửi Tin Nhắn Telegram Async & An Toàn Quota
- **Files**:
  - `src/lib/telegram.ts` (Tạo mới)
  - `wrangler.jsonc` (Thêm biến môi trường / Secret)
- **Mô tả kỹ thuật**:
  - Hàm `sendTelegramMessage(text: string, options?: { parse_mode?: 'HTML' | 'Markdown' })`:
    - Gọi API `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`.
    - Sử dụng `telegram_chat_id` từ bảng `properties` hoặc biến môi trường `TELEGRAM_CHAT_ID`.
    - **Guardrails**:
      - Timeout tối đa 3500ms (tránh treo Worker CPU).
      - Bọc `try / catch` an toàn (lỗi Telegram tuyệt đối KHÔNG làm crash hoặc gián đoạn luồng đặt phòng của lễ tân).
      - Sử dụng HTML format (`<b>`, `<code>`, `<i>`) an toàn, escape ký tự đặc biệt.
- **Tiêu chí nghiệm thu (DoD)**:
  - Gửi tin nhắn thành công về nhóm Telegram thử nghiệm; không gây chậm trễ Response của Worker.

#### TASK-06: Triển Khai 5 Kịch Bản Thông Báo Telegram
- **Files**:
  - `src/app/api/bookings/route.ts`
  - `src/app/api/bookings/[id]/route.ts`
  - `src/app/api/cron/daily-report/route.ts` (Tùy chọn)
- **Mô tả kỹ thuật**:
  - **TG-01 (Đặt phòng mới)**: Kích hoạt trong `POST /api/bookings`. Gửi thông tin: Phòng, Tên khách, SĐT, Giờ nhận/trả, Loại đặt, Tiền phòng/Cọc, Nhân viên phụ trách.
  - **TG-02 (Nhắc cọc đến hạn)**: Báo danh sách các đơn cần thu nốt cọc trong ngày.
  - **TG-03 (No-Show / Hủy phòng)**: Kích hoạt khi lễ tân bấm No-Show hoặc Hủy đơn. Báo rõ lý do, số tiền phạt/giữ lại và số tiền hoàn trả.
  - **TG-04 (Gia hạn giờ thêm)**: Kích hoạt khi bấm `+1h Trả trễ`. Báo giờ trả phòng mới và phụ phí phát sinh (+60k).
  - **TG-05 (Báo cáo doanh thu ca/ngày)**: Tổng hợp số lượng booking, tổng tiền thực thu, lượt check-in/out.
- **Tiêu chí nghiệm thu (DoD)**:
  - Cả 4 sự kiện thời gian thực (TG-01, TG-03, TG-04) bắn tin nhắn đầy đủ; format tin nhắn trực quan, đẹp mắt.

---

### 🟡 EPIC 4: SINH MÃ KHÓA CỬA 6 CHỮ SỐ & CÚ PHÁP NHẬN PHÒNG
> **Mục đích nghiệp vụ**: Every Inn là mô hình tự nhận phòng (self check-in). Mỗi lượt đặt phòng cần có một mã cửa 6 chữ số riêng biệt để khách mở khóa phòng khi đến nơi.

#### TASK-07: Bộ Sinh Mã Cửa Ngẫu Nhiên 6 Chữ Số (Door Code Generator)
- **Files**:
  - `src/lib/doorCode.ts` (Tạo mới)
  - `src/app/api/bookings/route.ts`
- **Mô tả kỹ thuật**:
  - Hàm `generateDoorCode()`: Sinh chuỗi ngẫu nhiên 6 chữ số (`100000` đến `999999`), loại bỏ các chuỗi số quá dễ đoán (VD: `111111`, `123456`).
  - Khi tạo booking mới trong `POST /api/bookings`, tự động sinh mã và lưu vào cột `door_code` trong bảng `bookings`.
- **Tiêu chí nghiệm thu (DoD)**:
  - Mọi booking mới đều có `door_code` gồm 6 chữ số.

#### TASK-08: Giao Diện Hiển Thị Mã Cửa & Mẫu Tin Nhắn Check-in 1-Click
- **Files**:
  - `src/components/dashboard/BookingDetailDrawer.tsx`
  - `src/components/bookings/CheckinInstructionModal.tsx` (Tạo mới)
- **Mô tả kỹ thuật**:
  - Trong `BookingDetailDrawer`:
    - Hiển thị khối **Mã mở cửa phòng**: `🔑 582914` kèm nút Copy nhanh.
    - Nút **"📋 Sao chép tin nhắn gửi khách"**:
      Tạo sẵn văn bản chuẩn để gửi qua Facebook / Instagram / Zalo cho khách:
      ```
      🏨 EVERY INN PHAN XÍCH LONG — THÔNG TIN NHẬN PHÒNG
      • Khách hàng: [Tên khách]
      • Phòng: [Tên phòng] (Tầng [X])
      • Nhận phòng: [Giờ] ngày [Ngày]
      • Trả phòng: [Giờ] ngày [Ngày]
      • Mã khóa cửa phòng: [DOOR_CODE] (Bấm mã + # để mở)
      • Mật khẩu WiFi: [WIFI_PASSWORD] (Tên: [WIFI_SSID])
      • Hướng dẫn vào phòng: [CHECKIN_INSTRUCTION]
      Chúc bạn có một kỳ nghỉ thật thư thái tại Every Inn! ✨
      ```
- **Tiêu chí nghiệm thu (DoD)**:
  - Lễ tân bấm 1 nút là copy toàn bộ nội dung hướng dẫn kèm mã khóa phòng vào clipboard.

---

### 🟡 EPIC 5: GIAO DIỆN QUẢN TRỊ CẤU HÌNH BẢNG GIÁ & NHÂN SỰ (`/settings`)
> **Mục đích nghiệp vụ**: Hiện tại việc thay đổi giá phòng, điều chỉnh phụ phí thêm giờ, đổi ngưỡng thăng hạng thành viên hoặc cấp tài khoản lễ tân mới phải thao tác qua SQL. Cần giao diện trực quan cho tài khoản Manager.

#### TASK-09: Trang Quản Trị Cấu Hình Hệ Thống (`/settings`)
- **Files**:
  - `src/app/settings/page.tsx` (Tạo mới)
  - `src/app/api/configs/route.ts`
  - `src/app/api/pricing-rules/route.ts`
- **Mô tả kỹ thuật**:
  - Phân quyền: Chỉ cho phép tài khoản có `role === 'manager'` truy cập; tài khoản `receptionist` chuyển hướng về `/dashboard` với toast cảnh báo.
  - Tab 1: **Bảng Giá & Phụ Phí**:
    - Chỉnh sửa giá Combo 3h, 6h, Qua đêm, Theo ngày cho từng hạng phòng (Haven / Signature).
    - Chỉnh sửa phụ phí giờ thêm (mặc định 60.000đ/h).
    - Sau khi lưu, tự động gọi `clearCache('master:pricing_rules')` để cập nhật in-memory cache ngay lập tức.
  - Tab 2: **Hạng Thành Viên Mini CDP**:
    - Chỉnh sửa ngưỡng chi tiêu & số lần đặt của Bronze, Silver, Gold.
    - Cập nhật `clearCache('master:cdp_tiers')`.
  - Tab 3: **Thông Tin Cơ Sở**:
    - Chỉnh sửa Tên khách sạn, Địa chỉ, Tài khoản ngân hàng, WiFi SSID/Pass, Hướng dẫn nhận phòng.
- **Tiêu chí nghiệm thu (DoD)**:
  - Quản lý đổi giá phòng xong, form tạo đơn mới và drawer tính giá lập tức áp dụng bảng giá mới.

#### TASK-10: Quản Lý Nhân Sự & Đổi Mật Khẩu
- **Files**:
  - `src/app/settings/staff/page.tsx` (hoặc Tab Nhân sự trong Settings)
  - `src/app/api/staff/route.ts`
  - `src/app/api/staff/[id]/route.ts`
- **Mô tả kỹ thuật**:
  - Danh sách tài khoản nhân viên (Họ tên, SĐT, Vai trò, Trạng thái hoạt động, Lần đăng nhập cuối).
  - Thêm nhân viên mới / Khóa tài khoản nghỉ việc (`is_active = 0`).
  - Đặt lại mật khẩu nhân viên (sử dụng `bcrypt.hash(password, 10)` — chú ý không dùng salt rounds > 10 để tránh lỗi CPU 10ms của Worker).
- **Tiêu chí nghiệm thu (DoD)**:
  - Tạo nhân viên mới và đăng nhập thử nghiệm thành công.

---

### ⚪ EPIC 6: GUEST VIEW PORTAL CÔNG KHAI (`/view/[publicToken]`)
> **Mục đích nghiệp vụ**: Cung cấp đường dẫn web bảo mật cho khách hàng tự xem phiếu đặt phòng của mình trên điện thoại mà không cần phải gọi hỏi lễ tân.

#### TASK-11: API Truy Xuất Thông Tin Đơn Công Khai Bằng Token
- **Files**:
  - `src/app/api/public/bookings/[token]/route.ts` (Tạo mới)
- **Mô tả kỹ thuật**:
  - Endpoint `GET /api/public/bookings/:token`:
    - Truy vấn đơn theo `public_token` (được sinh sẵn khi tạo booking).
    - Chỉ trả về dữ liệu an toàn dành cho khách: Tên khách, Phòng, Giờ nhận/trả phòng, Mã cửa (`door_code`), Hướng dẫn nhận phòng, WiFi, Trạng thái thanh toán (Đã cọc bao nhiêu, còn thiếu bao nhiêu, mã VietQR quét nốt nếu còn nợ).
    - **Bảo mật**: KHÔNG lộ thông tin quản trị, doanh thu gốc, ghi chú nội bộ (`closing_note`, `internal_notes`), thông tin nhân viên xử lý.
- **Tiêu chí nghiệm thu (DoD)**:
  - Truy cập đúng token trả về thông tin; token không tồn tại trả về 404 thân thiện.

#### TASK-12: Giao Diện Mobile Guest View Card
- **Files**:
  - `src/app/view/[token]/page.tsx` (Tạo mới)
- **Mô tả kỹ thuật**:
  - Giao diện thân thiện tối ưu cho màn hình điện thoại (Mobile-First):
    - Thẻ thông tin khách sạn sang trọng, gradient tinh tế theo nhận diện thương hiệu Every Inn.
    - Đồng hồ đếm ngược đến giờ nhận phòng.
    - Hộp mã số cửa lớn kèm nút sao chép và nút hướng dẫn mở khóa.
    - Nút chỉ đường Google Maps đến khách sạn Phan Xích Long.
    - Nút gọi hotline lễ tân 1-click (`tel:0901234567`).
- **Tiêu chí nghiệm thu (DoD)**:
  - Hiển thị hoàn hảo trên iOS Safari và Android Chrome; tải trang dưới 1 giây.

---

## 🤖 PHẦN 5: HƯỚNG DẪN THỰC THI DÀNH CHO MULTI-MODEL AGENTS

Nếu bạn là một AI model (Claude, GPT, Gemini, Cursor, v.v.) nhận được tài liệu này kèm yêu cầu triển khai một tính năng:

1. **Bước 1 — Xác định Task**:
   - Tra cứu mã Task tương ứng trong **Phần 4** (Ví dụ: `TASK-03`, `TASK-04`).
   - Đọc kỹ **Files affected**, **Mô tả kỹ thuật**, và **Tiêu chí nghiệm thu (DoD)**.
2. **Bước 2 — Kiểm tra Database & Migration**:
   - Kiểm tra xem các bảng hoặc cột liên quan đã có trong `db/migrations/` chưa.
   - Nếu cần thêm cột/bảng mới: Luôn tạo migration tiếp theo với số thứ tự kế tiếp (Ví dụ: `013_...sql`), đồng thời cập nhật `package.json` với script `db:migrate:013:local` và `db:migrate:013:remote`.
   - Tuyệt đối dùng lệnh SQL tương thích SQLite (`ALTER TABLE ADD COLUMN`, `CREATE INDEX IF NOT EXISTS`).
3. **Bước 3 — Tuân thủ Quy chuẩn Bất biến**:
   - Thời gian: Luôn dùng danh sách 48 slot `TIME_SLOTS_30MIN` từ `src/lib/timelineUtils.ts`.
   - Quota D1: Mọi câu lệnh SQL đọc danh sách phải dùng `INDEX`, có `LIMIT`, và dùng `event_logs.id` để hỗ trợ ETag 304.
   - Trạng thái: Dùng `BroadcastChannel("everyinn_sync_channel")` để phát thông báo `notifyDataChanged("BOOKINGS_CHANGED")` sau khi ghi dữ liệu.
4. **Bước 4 — Kiểm thử & Xác minh**:
   - Chạy `npx tsc --noEmit` để đảm bảo **0 lỗi TypeScript**.
   - Tạo file test script trong `scratch/` và chạy thử qua `node scratch/test_...mjs` để kiểm tra kết quả thực tế.
