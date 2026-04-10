-- CreateTable
CREATE TABLE "pos_cashier_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "conceptId" TEXT,
    "deviceId" TEXT NOT NULL,
    "cashierUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_cashier_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_cashier_sessions_tenantId_branchId_status_idx" ON "pos_cashier_sessions"("tenantId", "branchId", "status");

-- CreateIndex
CREATE INDEX "pos_cashier_sessions_deviceId_status_idx" ON "pos_cashier_sessions"("deviceId", "status");

-- AddForeignKey
ALTER TABLE "pos_cashier_sessions" ADD CONSTRAINT "pos_cashier_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_cashier_sessions" ADD CONSTRAINT "pos_cashier_sessions_cashierUserId_fkey" FOREIGN KEY ("cashierUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
