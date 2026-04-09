import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ShiftModule } from "../shift/shift.module";
import { PosSyncService } from "./pos-sync.service";
import { SyncController } from "./sync.controller";

@Module({
  imports: [DatabaseModule, OrdersModule, PaymentsModule, ShiftModule, RealtimeModule],
  controllers: [SyncController],
  providers: [PosSyncService],
  exports: [PosSyncService]
})
export class SyncModule {}
