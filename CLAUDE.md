# Every Inn Admin Panel — Claude Guide (post-Core, refreshed 2026-11-03)

> **Read first:** [`../everyinn-platform-docs/EI_PHASE1_STATUS.md`](../everyinn-platform-docs/EI_PHASE1_STATUS.md) for state and the task board, then
> [`../everyinn-platform-docs/CONVENTIONS.md`](../everyinn-platform-docs/CONVENTIONS.md) for rules (§7 covers the UI) and
> [`../everyinn-platform-docs/AGENT_INDEX.md`](../everyinn-platform-docs/AGENT_INDEX.md) for skills.
> **Main skill for this repo:** `everyinn-admin-feature`. Also `everyinn-core-client` and `everyinn-release-status`.
> `AGENTS.md` sections on D1 schema, `cache.ts`, `masterData.ts`, `validators.ts` and `cdp.ts` describe the **pre-Core app (retired in A-W7)**. Ignore them.

## Commands
```bash
npm run dev            # local Next.js (needs .dev.vars + bindings)
npm run lint           # must have 0 errors
npx tsc --noEmit       # must have 0 errors
npm test               # node --test test/**/*.test.mjs (FakeCore harness)
npm run cf:build       # lint + tsc + OpenNext build (what Workers Builds runs)
# Deploy = git push (dev → everyinn-admin-dev, main → everyinn-admin). `npm run deploy` exits 1 on purpose.
```

## Architecture in one breath
- **Zero business SQL.** Bookings, holds, rooms, rates, promotions and surcharges go through `BOOKING_CORE`; customers and loyalty go through `CDP_CORE`; the AI receptionist (AR-1) goes through `AGENT_CORE` (`entrypoint: "AdminApi"`). All of them are Service Bindings called via `src/lib/cores.ts`.
- **Admin's own D1** (`DB`) holds only staff and sessions (`db/admin-db/0001_staff.sql`, `src/lib/auth.ts`, `jwt.ts`).
- **BFF routes** live in `src/app/api/**/route.ts`. They call `getCurrentStaff()`, then a Core client, then map errors with `coreErrorResponse`/`toHttpError`. The Core enforces roles from `x-ei-actor-role`.
- **Mappers:** `src/lib/coreMappers.ts` turns Core DTOs into the legacy UI shapes. `src/lib/pricing.ts` is a **client preview mirror only**; the Core quote is authoritative.

## Invariants
1. Workers: no timers after the response, bcrypt rounds ≤ 10, no module-memory state for holds or transactions.
2. Writes: send `Idempotency-Key` once per user action (reuse it on retry). Mutations send `expectedVersion`; on 409, `toast.warning` and refetch.
3. Time: 30-minute slots (`TIME_SLOTS_30MIN` in `src/lib/timelineUtils.ts`), past slots disabled; business time is UTC+7.
4. Polling: ETag/304, adaptive 20→40→60 s, only while the tab is visible (pattern in `src/app/dashboard/page.tsx`). No WebSockets through OpenNext.
5. UI: **light theme** (slate-50/white, emerald primary, amber warn, rose error, sky = Haven, purple = Signature). Use `useToast()`, never `alert`/`confirm`. Copy is Vietnamese.
6. Never log raw phones or door codes. `maskPii` lives in `cores.ts`.

## Where to look
- **Shell and nav:** `src/components/layout/{AdminShell,Sidebar,Topbar}.tsx`. Nav items go in both the Sidebar and the AdminShell mobile nav.
- **Gantt and drawer:** `src/app/dashboard/page.tsx`, `src/components/dashboard/{GanttChart,BookingDetailDrawer,BookingEditForm}.tsx`
- **Booking create and hold wizard:** `src/components/bookings/{BookingForm,BookingWizard}.tsx`, `search/`, `checkout/`, `src/app/api/holds/**`
- **Telegram notify (send-only):** `src/lib/telegram.ts`
- **Promotions and surcharges:** `src/app/promotions/page.tsx`, `src/components/promotions/*`
- **Finance (manager-only):** `src/app/finance/page.tsx`
- **Tests:** `test/helpers/fakeCore.mjs`, `test/contract.test.mjs`, synced contracts in `contracts/*.openapi.json`
