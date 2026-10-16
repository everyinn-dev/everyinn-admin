# Every Inn Admin Panel — Claude Development Guide & Neural Knowledge Base

> **Primary Knowledge Base**: See [`AGENTS.md`](./AGENTS.md) for full neural map, database schema, lib functions, API routes, and component tree.  
> **Master Backlog & Task Specs**: See [`docs/project_status_and_backlog.md`](./docs/project_status_and_backlog.md) for the 6 Epics & 12 Tasks ready for implementation.  
> **Cloudflare Infrastructure Rules**: See [`.agents/rules/cloudflare-free-tier.md`](./.agents/rules/cloudflare-free-tier.md).  
> **Agent / MCP Index**: See [`.agents/README.md`](file:///Users/lap14666/Documents/private/every%20inn/van%20hanh/booking-page/everyinn-admin/.agents/README.md).

---

## ⚡ Quick Command Cheat-Sheet
```bash
npm run dev                  # Start Next.js local development
npx tsc --noEmit             # TypeScript validation (MUST PASS WITH 0 ERRORS)
npm run deploy               # Deploy OpenNext Cloudflare Worker bundle
npm run db:migrate:local     # Run local D1 migration 001
npm run db:migrate:012:local # Run latest deposit migration locally
npm run db:migrate:remote    # Run remote D1 migration 001
npm run db:migrate:012:remote# Run latest deposit migration on production D1
```

---

## 🛡️ Critical Invariant Guardrails (Must Never Violate)
1. **Cloudflare Worker Constraints (10ms CPU, 128MB RAM, Stateless)**:
   - NEVER use `setTimeout` or asynchronous timers after returning Response.
   - bcryptjs salt rounds MUST be `<= 10`.
   - In-memory cache (`src/lib/cache.ts`) is ONLY for Master Data (TTL 60 min). NEVER use module memory for hold locks or transactions.
2. **D1 Quota Constraints (5M Reads/day, Zero Unindexed Queries)**:
   - NEVER run unindexed `SELECT` on `bookings`, `members`, `room_blocks`, or `event_logs`.
   - Multi-table writes MUST use `await db.batch([stmt1, stmt2, ...])`.
   - List APIs MUST implement ETag 304 using `SELECT COALESCE(MAX(id), 0) FROM event_logs`.
3. **Time Standard (30-Minute Step)**:
   - Always use `TIME_SLOTS_30MIN` from `src/lib/timelineUtils.ts` (48 slots: `00:00` to `23:30`).
   - Past slots on current date (UTC+7) MUST be disabled.
4. **Deposit & CDP Accounting**:
   - Total spent on member profiles accumulates strictly based on **realized cash paid** (`paid_amount`), NOT uncollected total price.
5. **UI & Notifications**:
   - Dark Slate palette with Amber/Emerald/Purple accent badges.
   - NEVER use `window.alert()`. Use `useToast()` hook.

---

## 🔍 Fast Neural Lookup (Where to Look)
- **Pricing & Combos**: `src/lib/pricing.ts` (`calculatePrice`)
- **Cleaning Buffer (1h)**: `src/lib/validators.ts` (`checkBookingOverlapWithBuffer`)
- **Promotions Engine**: `src/lib/promotions.ts` (`validatePromotionEligibility`, `computePromotionDiscount`)
- **Timeline & 30-min Slots**: `src/lib/timelineUtils.ts` (`TIME_SLOTS_30MIN`, `roundToNearest30Min`)
- **Mini CDP & Loyalty**: `src/lib/cdp.ts` (`calculateLoyaltyTier`, `upsertMemberOnBooking`)
- **Gantt Dashboard**: `src/components/dashboard/GanttChart.tsx`, `GanttBar.tsx`, `BookingDetailDrawer.tsx`
- **Deposit Tracking**: `src/components/bookings/DepositSection.tsx`, `DepositReminderModal.tsx`
- **New Booking Form**: `src/components/bookings/BookingForm.tsx`, `PriceSummaryCard.tsx`
