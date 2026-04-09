import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { AiService } from "./ai.service";
import { ForecastQueryDto } from "./dto/forecast.dto";

@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get("forecast/sales")
  sales(@CurrentTenant() ctx: TenantContext, @Query() query: ForecastQueryDto) {
    return this.aiService.forecastSales(ctx, query);
  }

  @Get("forecast/inventory")
  inventory(@CurrentTenant() ctx: TenantContext, @Query() query: ForecastQueryDto) {
    return this.aiService.forecastInventory(ctx, query);
  }

  @Get("reorder")
  reorder(@CurrentTenant() ctx: TenantContext, @Query() query: ForecastQueryDto) {
    return this.aiService.reorder(ctx, query);
  }

  @Post("reorder/apply")
  applyReorder(@CurrentTenant() ctx: TenantContext, @Body() body: { inventory_item_id: string }) {
    return this.aiService.applyReorder(ctx, body.inventory_item_id);
  }

  @Get("dynamic-pricing")
  dynamicPricing(@CurrentTenant() ctx: TenantContext, @Query() query: ForecastQueryDto) {
    return this.aiService.dynamicPricing(ctx, query);
  }

  @Get("waste")
  waste(@CurrentTenant() ctx: TenantContext, @Query() query: ForecastQueryDto) {
    return this.aiService.wastePrediction(ctx, query);
  }
}
