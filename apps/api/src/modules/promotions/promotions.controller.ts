import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { CreatePromotionDto } from "./dto/promotions.dto";
import { PromotionsService } from "./promotions.service";

@Controller("promotions")
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreatePromotionDto) {
    return this.promotionsService.createPromotion(ctx, dto);
  }

  @Get(":id")
  getById(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.promotionsService.getPromotion(ctx, id);
  }
}
