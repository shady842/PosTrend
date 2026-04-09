import { Body, Controller, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { AddOrderItemDto, CreateOrderDto } from "./dto/orders.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentTenant() ctx: TenantContext) {
    return this.ordersService.create({
      ...dto,
      tenant_id: ctx.tenant_id,
      concept_id: ctx.concept_id,
      branch_id: ctx.branch_id
    });
  }

  @Post(":id/items")
  addItem(
    @Param("id") id: string,
    @Body() dto: AddOrderItemDto,
    @CurrentTenant() ctx: TenantContext
  ) {
    return this.ordersService.addItem(id, {
      ...dto,
      tenant_id: ctx.tenant_id,
      concept_id: ctx.concept_id,
      branch_id: ctx.branch_id
    });
  }

  @Post(":id/send-kitchen")
  sendKitchen(@Param("id") id: string, @CurrentTenant() ctx: TenantContext) {
    return this.ordersService.sendKitchen(id, ctx);
  }

  @Post(":id/close")
  close(@Param("id") id: string, @CurrentTenant() ctx: TenantContext) {
    return this.ordersService.close(id, ctx);
  }
}
