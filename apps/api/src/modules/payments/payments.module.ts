import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { InventoryModule } from "../inventory/inventory.module";
import { OrdersModule } from "../orders/orders.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { PostingModule } from "../posting/posting.module";
import { PosPaymentsController } from "./pos-payments.controller";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [OrdersModule, AccountingModule, InventoryModule, RealtimeModule, PostingModule],
  controllers: [PaymentsController, PosPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
