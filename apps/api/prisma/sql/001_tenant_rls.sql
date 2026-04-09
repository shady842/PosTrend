-- Phase 1 hardening: Row Level Security policy templates.
-- Execute after creating tables via Prisma migrations.

-- 1) Enable RLS on key multi-tenant tables.
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalLine" ENABLE ROW LEVEL SECURITY;

-- 2) App must set tenant context per request:
--    SET app.tenant_id = '<tenant-uuid>';
--    SET app.concept_id = '<concept-uuid>';
--    SET app.branch_id = '<branch-uuid>';

-- 3) Tenant-level policy.
CREATE POLICY tenant_isolation_order ON "Order"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_order_item ON "OrderItem"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_payment ON "Payment"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_inventory ON "InventoryItem"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_stock_ledger ON "StockLedger"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_journal_entry ON "JournalEntry"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_journal_line ON "JournalLine"
  USING ("tenantId" = current_setting('app.tenant_id', true));
