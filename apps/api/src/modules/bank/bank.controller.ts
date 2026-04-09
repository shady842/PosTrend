import { Body, Controller, Get, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { BankService } from "./bank.service";
import { ImportBankTransactionsDto, ReconcileBankDto } from "./dto/bank.dto";

@Controller("bank")
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get("accounts")
  accounts(@CurrentTenant() ctx: TenantContext) {
    return this.bankService.getAccounts(ctx);
  }

  @Post("transactions/import")
  import(@CurrentTenant() ctx: TenantContext, @Body() dto: ImportBankTransactionsDto) {
    return this.bankService.importTransactions(ctx, dto);
  }

  @Post("reconcile")
  reconcile(@CurrentTenant() ctx: TenantContext, @Body() dto: ReconcileBankDto) {
    return this.bankService.reconcile(ctx, dto);
  }

  @Get("reports")
  reports(@CurrentTenant() ctx: TenantContext) {
    return this.bankService.reports(ctx);
  }
}
