# PosTrend Platform

Phase 1 implementation baseline for a production-grade multi-tenant F&B POS SaaS.

## Current status

- Monorepo workspace initialized
- NestJS modular monolith API scaffolded
- Phase 1 module endpoints implemented:
  - auth, tenant, org, menu, orders, payments, kds, inventory, shift/day-close, sync, reports
- Prisma schema added with tenant/concept/branch scoped models
- Docker compose added for PostgreSQL + Redis
- JWT auth guard + role metadata guard enabled globally
- Realtime WebSocket gateway added for KDS/sync events
- SaaS Phase 2 core implemented (signup, trial, plans, concepts, branches, devices, POS login)
- Health endpoint ready at `/v1/health`

## Run

1. Install dependencies:
   - `npm install`
2. Copy env:
   - `copy .env.example .env`
3. Start infra:
   - `docker compose -f infra/docker/docker-compose.yml up -d`
4. Run API in dev mode:
   - `npm run start:dev`
5. Build check:
   - `npm run build`
6. Generate Prisma client:
   - `npm run -w apps/api prisma:generate`
7. Run DB migration:
   - `npm run -w apps/api prisma:migrate:dev`
8. Seed demo data:
   - `npm run -w apps/api prisma:seed`

## Phase 1 API Surface

- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `GET /v1/tenant/me`
- `GET /v1/concepts`
- `GET /v1/menu/catalog`
- `POST /v1/orders`
- `POST /v1/orders/:id/items`
- `POST /v1/orders/:id/send-kitchen`
- `POST /v1/orders/:id/payments`
- `GET /v1/kds/tickets`
- `GET /v1/inventory/stock`
- `POST /v1/day-close/execute`
- `POST /v1/sync/push`
- `GET /v1/sync/pull`

## SaaS Phase 2 API Surface

- `GET /v1/public/plans`
- `POST /v1/public/signup`
- `POST /v1/auth/login`
- `GET /v1/tenant/me`
- `GET /v1/tenant/subscription`
- `POST /v1/concepts`
- `POST /v1/branches`
- `POST /v1/devices/register`
- `POST /v1/pos/device-login`
