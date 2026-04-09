# Global ERP Hardening Pass

This pass upgrades PosTrend toward enterprise F&B ERP operations.

## Hardening Principles

- No quantity-only accounting for COGS.
- Every inventory movement must have stock ledger traceability.
- Every operational event must be postable to accounting.
- Item master must support enterprise attributes (UOM, pricing, suppliers, stock rules, accounting mapping).
- ERP UX should support wizard flows, inline edits, bulk operations, and quick action from operational pages.

## Implemented in This Pass

### Backend

- COGS hardening in `apps/api/src/modules/inventory/inventory.service.ts`
  - `consumeForOrder` now calculates valued COGS using weighted average unit cost from received PO lines.
  - COGS passed to accounting is currency-valued (rounded), not raw quantity.

### Inventory UI Foundations

- New enterprise item wizard route:
  - `apps/admin/app/(protected)/inventory/item-master/page.tsx`
  - `apps/admin/components/inventory/item-master-wizard.tsx`
- New replenishment workspace:
  - `apps/admin/app/(protected)/inventory/reorder/page.tsx`
- New stock count session workspace:
  - `apps/admin/app/(protected)/inventory/stock-counts/page.tsx`
- New production build workspace:
  - `apps/admin/app/(protected)/inventory/production/page.tsx`
- Inventory nav expanded:
  - `apps/admin/components/inventory/inventory-nav.tsx`

## Next Hardening Targets

1. Prisma schema expansion for:
   - multi-UOM conversion matrix
   - item-supplier mapping table
   - inventory account mapping tables
   - production orders + production lines + production ledger refs
2. FEFO lot depletion and lot-level consumption linking.
3. Full posting coverage for `PRODUCTION` and `PAYROLL_PROCESSED`.
4. User/employee unification migration path and HR workflow alignment.
5. Advanced inventory valuation mode selection (moving average/FIFO).

