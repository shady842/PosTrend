import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";

@Module({
  imports: [AccountingModule],
  controllers: [SuppliersController],
  providers: [SuppliersService]
})
export class SuppliersModule {}
