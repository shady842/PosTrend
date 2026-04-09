import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import {
  CreateApBillDto,
  CreateArInvoiceDto,
  AccountingReportQueryDto,
  CreateChartOfAccountDto,
  CreateJournalEntryDto,
  ListJournalEntriesDto,
  UpdateJournalEntryDto
} from "./dto/accounting.dto";
import { AccountingService } from "./accounting.service";

@Controller("accounting")
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get("chart-of-accounts")
  chartOfAccounts(@CurrentTenant() ctx: TenantContext) {
    return this.accountingService.getChartOfAccounts(ctx);
  }

  @Post("chart-of-accounts")
  createChartOfAccount(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateChartOfAccountDto) {
    return this.accountingService.createChartOfAccount(ctx, dto);
  }

  @Post("journal-entry")
  journalEntry(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateJournalEntryDto) {
    return this.accountingService.createJournalEntry(ctx, dto);
  }

  @Get("journal-entries")
  listJournalEntries(@CurrentTenant() ctx: TenantContext, @Query() q: ListJournalEntriesDto) {
    return this.accountingService.listJournalEntries(ctx, q);
  }

  @Get("journal-entry/:id")
  getJournalEntry(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.accountingService.getJournalEntry(ctx, id);
  }

  @Patch("journal-entry/:id")
  updateJournalEntry(@CurrentTenant() ctx: TenantContext, @Param("id") id: string, @Body() dto: UpdateJournalEntryDto) {
    return this.accountingService.updateJournalEntry(ctx, id, dto);
  }

  @Post("journal-entry/:id/post")
  post(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.accountingService.postJournalEntry(ctx, id);
  }

  @Post("journal-entry/:id/unpost")
  unpost(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.accountingService.unpostJournalEntry(ctx, id);
  }

  @Post("ar-invoice")
  createArInvoice(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateArInvoiceDto) {
    return this.accountingService.createArInvoice(ctx, dto);
  }

  @Post("ap-bill")
  createApBill(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateApBillDto) {
    return this.accountingService.createApBill(ctx, dto);
  }

  @Get("tax-ledger")
  getTaxLedger(@CurrentTenant() ctx: TenantContext) {
    return this.accountingService.getTaxLedger(ctx);
  }

  @Get("general-ledger")
  generalLedger(@CurrentTenant() ctx: TenantContext, @Query() q: AccountingReportQueryDto) {
    return this.accountingService.getGeneralLedger(ctx, q);
  }

  @Get("trial-balance")
  trialBalance(@CurrentTenant() ctx: TenantContext, @Query() q: AccountingReportQueryDto) {
    return this.accountingService.getTrialBalance(ctx, q);
  }

  @Get("profit-loss")
  profitLoss(@CurrentTenant() ctx: TenantContext, @Query() q: AccountingReportQueryDto) {
    return this.accountingService.getProfitLoss(ctx, q);
  }

  @Get("balance-sheet")
  balanceSheet(@CurrentTenant() ctx: TenantContext, @Query() q: AccountingReportQueryDto) {
    return this.accountingService.getBalanceSheet(ctx, q);
  }

  @Get("ar-invoices")
  listAr(@CurrentTenant() ctx: TenantContext, @Query("status") status?: string) {
    return this.accountingService.listArInvoices(ctx, status);
  }

  @Get("ap-bills")
  listAp(@CurrentTenant() ctx: TenantContext, @Query("status") status?: string) {
    return this.accountingService.listApBills(ctx, status);
  }
}
