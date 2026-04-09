-- SYNC-5: entity versions + sync audit logs
CREATE TABLE "entity_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastMutationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "entity_versions_tenantId_entityType_entityId_key" ON "entity_versions"("tenantId", "entityType", "entityId");

CREATE INDEX "entity_versions_tenantId_entityType_idx" ON "entity_versions"("tenantId", "entityType");

CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "deviceId" TEXT,
    "opId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "opType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "clientTimestamp" TIMESTAMP(3),
    "entityType" TEXT,
    "entityId" TEXT,
    "serverVersion" INTEGER,
    "resolution" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_logs_tenantId_createdAt_idx" ON "sync_logs"("tenantId", "createdAt");

CREATE INDEX "sync_logs_tenantId_idempotencyKey_idx" ON "sync_logs"("tenantId", "idempotencyKey");
