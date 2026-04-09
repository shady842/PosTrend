import { forwardRef, Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PostingModule } from "../posting/posting.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  imports: [AccountingModule, forwardRef(() => PostingModule)],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    // Alias token to avoid circular import usage in PostingService.
    { provide: "INVENTORY_SERVICE", useExisting: InventoryService }
  ],
  exports: [InventoryService]
})
export class InventoryModule {}
