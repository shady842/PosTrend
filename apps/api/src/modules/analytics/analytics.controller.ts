import { Controller, Get, Query } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { AnalyticsFilterDto } from "./dto/analytics.dto";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("sales")
  sales(@CurrentTenant() ctx: TenantContext, @Query() query: AnalyticsFilterDto) {
    return this.analyticsService.sales(ctx, query);
  }

  @Get("items")
  items(@CurrentTenant() ctx: TenantContext, @Query() query: AnalyticsFilterDto) {
    return this.analyticsService.items(ctx, query);
  }

  @Get("customers")
  customers(@CurrentTenant() ctx: TenantContext, @Query() query: AnalyticsFilterDto) {
    return this.analyticsService.customers(ctx, query);
  }

  @Get("inventory")
  inventory(@CurrentTenant() ctx: TenantContext, @Query() query: AnalyticsFilterDto) {
    return this.analyticsService.inventory(ctx, query);
  }

  @Get("purchase")
  purchase(@CurrentTenant() ctx: TenantContext, @Query() query: AnalyticsFilterDto) {
    return this.analyticsService.purchase(ctx, query);
  }

  @Get("profitability")
  profitability(@CurrentTenant() ctx: TenantContext, @Query() query: AnalyticsFilterDto) {
    return this.analyticsService.profitability(ctx, query);
  }
}
