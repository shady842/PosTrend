# Phase 1 Hardening Checklist

## Transactional Integrity

- Payment capture and accounting posting run in a single DB transaction.
- Order close and inventory deduction run in a single DB transaction.
- Runtime logs include order/payment identifiers for rollback diagnostics.

## Tenant Isolation

- RLS policy SQL template exists: `apps/api/prisma/sql/001_tenant_rls.sql`.
- API layer always carries tenant context in JWT payload.
- DB session settings (`app.tenant_id`) are set before query execution in production deployment.

## Runtime Readiness

- Build passes (`npm run build`).
- Prisma client generation passes (`npm run -w apps/api prisma:generate`).
- Local infra boot path documented (Postgres + Redis).

## Next Ops Step

- Add middleware to set PostgreSQL session variables per request using authenticated JWT claims.
