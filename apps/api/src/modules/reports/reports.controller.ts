import { Controller, Get, Query } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { ReportFilterDto } from "./dto/reports.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("sales")
  sales(@CurrentTenant() ctx: TenantContext, @Query() query: ReportFilterDto) {
    return this.reportsService.sales(ctx, query);
  }

  @Get("items")
  items(@CurrentTenant() ctx: TenantContext, @Query() query: ReportFilterDto) {
    return this.reportsService.items(ctx, query);
  }

  @Get("cashier")
  cashier(@CurrentTenant() ctx: TenantContext, @Query() query: ReportFilterDto) {
    return this.reportsService.cashier(ctx, query);
  }

  @Get("shifts")
  shifts(@CurrentTenant() ctx: TenantContext, @Query() query: ReportFilterDto) {
    return this.reportsService.shifts(ctx, query);
  }

  @Get("day-close")
  dayClose(@CurrentTenant() ctx: TenantContext, @Query() query: ReportFilterDto) {
    return this.reportsService.dayClose(ctx, query);
  }

  @Get("inventory")
  inventory(@CurrentTenant() ctx: TenantContext, @Query() query: ReportFilterDto) {
    return this.reportsService.inventory(ctx, query);
  }

  @Get("discounts-refunds")
  discountsRefunds(@CurrentTenant() ctx: TenantContext, @Query() query: ReportFilterDto) {
    return this.reportsService.discountsRefunds(ctx, query);
  }
}
