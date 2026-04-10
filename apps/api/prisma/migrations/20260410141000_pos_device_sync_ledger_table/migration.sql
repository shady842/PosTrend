-- Create missing SYNC-5 idempotency ledger table
CREATE TABLE "pos_device_sync_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "deviceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "opType" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_device_sync_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_device_sync_ledger_tenantId_idempotencyKey_key"
ON "pos_device_sync_ledger"("tenantId", "idempotencyKey");
