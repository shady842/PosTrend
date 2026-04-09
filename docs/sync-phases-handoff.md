# PosTrend — Sync & realtime handoff (for new chats)

Use this file to restore context in a new Cursor chat.

## SYNC-1: WebSocket gateway (API)

- **Rooms:** `orders.branch.{id}`, `kds.branch.{id}`, `pos.branch.{id}`, `admin.tenant.{id}`
- **Auth:** JWT via `handshake.auth.token` or `Authorization: Bearer`
- **Events:** `order.created|updated|closed`, `payment.added`, `kds.updated`, `sync.delta.available`, plus SYNC-3 kitchen events below
- **Files:** `apps/api/src/modules/realtime/realtime.gateway.ts`, `realtime.constants.ts`, `realtime.module.ts`
- **Broadcasts:** wired from `orders`, `payments`, `kds`, `pos-sync` services

## SYNC-2: POS realtime (Flutter)

- **Subscribe:** `orders.branch.{branchId}` via `PosRealtimeSync`
- **File:** `apps/pos_flutter/lib/services/pos_realtime_sync.dart`
- **UI:** `TablesScreen` debounced refresh; `PosHomeScreen` starts sync; `PaymentScreen` listens to `orderEvents`; logout stops sync in `settings_screen.dart`

## SYNC-3: KDS realtime

- **Server:** `order.sent`, `item.preparing`, `item.ready` (+ `emitKitchenBranchWide` → kds/pos/orders/admin)
- **KDS app:** `kds_screen.dart` subscribes **only** `kds.branch.{id}`
- **POS:** `pos_realtime_sync.dart` also listens for kitchen events on `orders.branch`

## SYNC-4: Admin dashboard realtime

- **Subscribe:** `admin.tenant.{tenantId}` — `apps/admin/hooks/use-admin-tenant-realtime.ts`
- **Dashboard:** `apps/admin/app/(protected)/dashboard/page.tsx` — quiet refresh, live pill, `/reports/live` widgets
- **API:** `GET /v1/reports/live` in `reports.service.ts` / `reports.controller.ts`
- **Shared WS origin:** `apps/admin/lib/ws-origin.ts` (also used by live-pos)

## SYNC-5: Sync conflict resolver (partial / in progress)

- **Schema:** `EntityVersion`, `SyncLog` in `prisma/schema.prisma`; migration `20260409140000_sync_conflict_resolver`
- **Service (draft):** `apps/api/src/modules/sync/sync-conflict.service.ts`
- **Still to wire:** `SyncPushOpDto` extensions (`op_id`, `client_timestamp`, payload `expected_version`), `PosSyncService` + `sync.module.ts`, Flutter `offline_sync_engine.dart` op metadata, `conflict_stale` handling

## Other notes

- **ConfirmDialog:** `apps/admin/components/confirm-dialog.tsx` — optional `confirmLabel`, `confirmDisabled`
- **Device pairing:** admin `devices` page — register modal + `POST devices/:id/rotate-secret`

---

*Generated as a chat record / handoff. Update SYNC-5 when implementation is finished.*
