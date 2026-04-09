# PosTrend — AI Checkpoint (keep chats fast)

If chat becomes slow, tell the assistant to **only read this file** + any new errors/files you mention.

## How to run (dev)
- **API**: `npm run start:dev` (Nest, `http://localhost:3000`, prefix `/v1`)
- **Admin**: `npm run start:admin` (Next, `http://localhost:3001`)
- **Both**: `npm run dev`

## What’s implemented (UI phases)

### Phase 3 — Menu Builder (Admin)
- Menu builder at `apps/admin/app/(protected)/menu/page.tsx`
- Categories sidebar, items grid, item drawer, modifiers, reorder, image upload, toggles
- Wired to Nest `/v1/menu/*`

### Phase 4 — Inventory (Admin + API)
- Admin routes under `apps/admin/app/(protected)/inventory/*`
  - overview, items, stock, purchase orders, suppliers, transfers, wastage
- Key UI components:
  - `apps/admin/components/inventory/advanced-table.tsx`
  - `apps/admin/components/inventory/inventory-nav.tsx`
- Inventory items creation:
  - API: `POST /v1/inventory/items`
  - Admin UI: Inventory → Items has **Add item** drawer: `apps/admin/app/(protected)/inventory/items/page.tsx`

### Phase 5 — Live POS Monitoring (Admin + API)
**Admin**
- Route: `apps/admin/app/(protected)/live-pos/page.tsx`
- Kitchen-style Kanban board with columns:
  - `open`, `preparing`, `ready`, `paid`, `closed`
- Drag between statuses (dnd-kit), animations (framer-motion)
- Filters: **branch** + **station**
- Auto refresh every 30s + manual refresh
- WebSocket updates via Socket.IO: listens to `pos.order.updated` and reloads

**API**
- `GET /v1/pos/orders/live?branch_id=&station_id=`: live board payload
- `POST /v1/pos/orders/monitor-move`: `{ order_id, column }`
  - `paid` requires full payment
  - `closed` runs normal close flow
- `GET /v1/kds/stations?branch_id=`: station dropdown
- WebSocket:
  - client emits `join_branch { branch_id }`
  - server emits `pos.order.updated { order_id, branch_id }`
- Important: monitor move/close uses **concept-scoped** lookup so admin can filter a branch that differs from JWT’s `branch_id`.

## Key files (Admin)
- Auth + fetch: `apps/admin/lib/api.ts`, `apps/admin/lib/auth.ts`
- Middleware matcher excludes Next internals: `apps/admin/middleware.ts`
- Sidebar + nav:
  - `apps/admin/components/sidebar.tsx` (has **Live POS** link)
  - `apps/admin/components/app-layout.tsx` (crumbs includes `/live-pos`)

## Key files (API)
- Orders: `apps/api/src/modules/orders/*`
- KDS: `apps/api/src/modules/kds/*`
- Realtime gateway: `apps/api/src/modules/realtime/realtime.gateway.ts`

## Notes
- If `ERR_CONNECTION_REFUSED` on `:3001`, admin dev server isn’t running.
- If `EADDRINUSE` on `3000/3001`, stop the old process using that port.

## Phase 6 — Accounting (latest state)

### Implemented now (working pages + API)
- Journal entries page is functional:
  - Route: `apps/admin/app/(protected)/accounting/journal-entries/page.tsx`
  - Features: create, edit (draft manual only), Dr/Cr line editor, post/unpost, list, filters, totals footer, CSV export.
- New accounting pages (no 404):
  - `/accounting/general-ledger`
  - `/accounting/profit-loss`
  - `/accounting/balance-sheet`
  - `/accounting/trial-balance`
  - `/accounting/accounts-receivable`
  - `/accounting/accounts-payable`
- COA creation added:
  - UI button + drawer at `/accounting/chart-of-accounts`
  - API: `POST /v1/accounting/chart-of-accounts`
- AR/AP creation added:
  - AR page has **New** drawer → `POST /v1/accounting/ar-invoice`
  - AP page has **New** drawer → `POST /v1/accounting/ap-bill`
  - Customers list endpoint added for AR form dropdown: `GET /v1/customers`

### Accounting API endpoints now available
- `GET /v1/accounting/chart-of-accounts`
- `POST /v1/accounting/chart-of-accounts`
- `POST /v1/accounting/journal-entry`
- `GET /v1/accounting/journal-entries`
- `GET /v1/accounting/journal-entry/:id`
- `PATCH /v1/accounting/journal-entry/:id`
- `POST /v1/accounting/journal-entry/:id/post`
- `POST /v1/accounting/journal-entry/:id/unpost`
- `GET /v1/accounting/general-ledger`
- `GET /v1/accounting/profit-loss`
- `GET /v1/accounting/balance-sheet`
- `GET /v1/accounting/trial-balance`
- `GET /v1/accounting/ar-invoices`
- `POST /v1/accounting/ar-invoice`
- `GET /v1/accounting/ap-bills`
- `POST /v1/accounting/ap-bill`
- `GET /v1/accounting/tax-ledger`

### Data-model update
- `JournalEntry.postedAt` changed to nullable in Prisma:
  - `null` = draft/unposted
  - datetime = posted

### Posting engine (backend)
- Added module: `apps/api/src/modules/posting/*`
- Event contract added for:
  - `ORDER_PAID`, `PURCHASE_RECEIVED`, `STOCK_TRANSFER`, `WASTAGE`, `PRODUCTION`, `PAYROLL_PROCESSED`, `DEPRECIATION_RUN`, `BANK_RECONCILED`
- Currently wired in flows:
  - `ORDER_PAID`, `PURCHASE_RECEIVED`, `STOCK_TRANSFER`, `WASTAGE`
- Some events remain stubbed (throw until domain models exist): production/payroll/depreciation/bank-reconcile.

### Known caveats
- In production build, avoid direct `localStorage` reads in state initializers. This was fixed in accounting report pages by moving reads to `useEffect`.
- If `npm run dev` fails for admin with `EADDRINUSE 3001`, restart admin with:
  - `npm run start:admin`


