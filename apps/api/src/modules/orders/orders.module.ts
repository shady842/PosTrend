import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { KdsModule } from "../kds/kds.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ShiftModule } from "../shift/shift.module";
import { OrdersController } from "./orders.controller";
import { PosOrdersController } from "./pos-orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [InventoryModule, RealtimeModule, KdsModule, ShiftModule],
  controllers: [OrdersController, PosOrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
