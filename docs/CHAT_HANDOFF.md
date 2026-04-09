# Chat handoff record (PosTrend — realtime & sync work)

**Date context:** April 2026. Use this when starting a **new Cursor chat** (paste or `@` this file).

## How to open a new chat

In Cursor: start a **New Chat** or **New Composer** from the sidebar / command palette. This file is the durable summary; the old thread is not automatically linked.

---

## Done in codebase (high level)

### SYNC-1 — WebSocket gateway (API)

- `apps/api/src/modules/realtime/realtime.gateway.ts`: JWT on connect, rooms `orders.branch.*`, `kds.branch.*`, `pos.branch.*`, `admin.tenant.*`, `realtime.subscribe` / `unsubscribe`, legacy `join_branch`.
- Events include `order.*`, `payment.added`, `kds.updated`, plus SYNC-3 kitchen events below.
- `realtime.constants.ts` for room helpers and event names.

### SYNC-2 — POS realtime (Flutter)

- `apps/pos_flutter/lib/services/pos_realtime_sync.dart`: subscribes `orders.branch.{branchId}`, debounced refresh, `orderEvents` stream, persisted last `ts`, reconnect.
- Wired: `PosHomeScreen`, `TablesScreen` (silent refresh), `PaymentScreen`, logout in `Settings`.

### SYNC-3 — KDS realtime

- API: `order.sent`, `item.preparing`, `item.ready` via `emitKitchenBranchWide` (kds + pos + orders + admin).
- `kds.service.ts`: `order.sent` on ticket create; preparing/ready on ticket update.
- Flutter KDS: subscribes **only** `kds.branch.{id}`, debounced refresh, reconnect.

### SYNC-4 — Admin dashboard realtime

- `GET /v1/reports/live` — `active_orders`, `kds_tickets`, `occupied_tables`.
- `apps/admin/lib/ws-origin.ts`, `hooks/use-admin-tenant-realtime.ts` → `admin.tenant.{tenantId}`.
- `apps/admin/app/(protected)/dashboard/page.tsx`: live pill, live ops row, quiet refresh on WS.

### Other (earlier threads)

- Device pairing: admin devices page + `rotate-secret` API; `ConfirmDialog` `confirmLabel` / `confirmDisabled`.
- `ConfirmDialog` in `apps/admin/components/confirm-dialog.tsx`.

---

## SYNC-5 — Conflict resolver (partial / TODO)

**Completed**

- Prisma: `EntityVersion`, `SyncLog` + migration `20260409140000_sync_conflict_resolver`.
- `apps/api/src/modules/sync/sync-conflict.service.ts`: candidate order ids, version + LWW check, bump order version, `appendLog`.
- `SyncPushOpDto`: optional `op_id`, `client_timestamp`.
- `sync.module.ts`: registers `SyncConflictService`.

**Still to do**

1. **Wire `PosSyncService`** to inject `SyncConflictService`: before `dispatch`, run version checks on existing orders; on success `bumpOrdersFromOp` + `appendLog` for every outcome (applied / duplicate / rejected / `conflict_stale`).
2. **Payload**: document optional `expected_version` on order/payment/table payloads for strict concurrency.
3. **Flutter** `offline_sync_engine.dart`: send `op_id` (outbox id), `client_timestamp` (`created_at`); treat `conflict_stale` like **synced** (or explicit UX) so the queue does not spin forever.
4. Run **`npx prisma migrate deploy`** (or `migrate dev`) on environments that do not have the new tables yet.

---

## Quick file index

| Area        | Paths |
|------------|--------|
| Realtime   | `apps/api/src/modules/realtime/*` |
| Sync push  | `apps/api/src/modules/sync/pos-sync.service.ts`, `sync.controller.ts` |
| Admin WS   | `apps/admin/hooks/use-admin-tenant-realtime.ts`, `lib/ws-origin.ts` |
| Live POS   | `apps/admin/app/(protected)/live-pos/page.tsx` |
| POS sync   | `apps/pos_flutter/lib/services/offline_sync_engine.dart`, `pos_realtime_sync.dart` |

---

## Commands

- API build: `npm run -w apps/api build`
- Prisma: `npm run -w apps/api prisma:generate` after schema changes
