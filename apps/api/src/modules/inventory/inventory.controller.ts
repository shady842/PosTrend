import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { Roles } from "../auth/decorators/roles.decorator";
import { InventoryService } from "./inventory.service";
import {
  CreateInventoryItemDto,
  ProductionBuildDto,
  CreatePurchaseOrderDto,
  StockAdjustmentDto,
  StockCountDto,
  StockTransferDto,
  WastageDto
} from "./dto/inventory.dto";

@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("items")
  getItems(@CurrentTenant() ctx: TenantContext) {
    return this.inventoryService.getItems(ctx);
  }

  @Post("items")
  @Roles("tenant_owner", "branch_manager", "inventory_manager")
  createItem(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.createItem(ctx, dto);
  }

  @Get("uoms")
  listUoms() {
    return this.inventoryService.listUoms();
  }

  @Get("stock-levels")
  getStockLevels(@CurrentTenant() ctx: TenantContext) {
    return this.inventoryService.getStockLevels(ctx);
  }

  @Get("insights")
  getInsights(@CurrentTenant() ctx: TenantContext) {
    return this.inventoryService.getInsights(ctx);
  }

  @Get("purchase-orders")
  listPurchaseOrders(@CurrentTenant() ctx: TenantContext) {
    return this.inventoryService.listPurchaseOrders(ctx);
  }

  @Get("transfers")
  listTransfers(@CurrentTenant() ctx: TenantContext) {
    return this.inventoryService.listTransfers(ctx);
  }

  @Get("wastage")
  listWastage(@CurrentTenant() ctx: TenantContext) {
    return this.inventoryService.listWastage(ctx);
  }

  @Post("adjust")
  @Roles("tenant_owner", "branch_manager", "inventory_manager")
  adjust(@CurrentTenant() ctx: TenantContext, @Body() dto: StockAdjustmentDto) {
    return this.inventoryService.adjustStock(ctx, dto);
  }

  @Post("stock-count")
  @Roles("tenant_owner", "branch_manager", "inventory_manager")
  stockCount(@CurrentTenant() ctx: TenantContext, @Body() dto: StockCountDto) {
    return this.inventoryService.stockCount(ctx, dto);
  }

  @Post("purchase-order")
  @Roles("tenant_owner", "branch_manager", "inventory_manager")
  purchaseOrder(@CurrentTenant() ctx: TenantContext, @Body() dto: CreatePurchaseOrderDto) {
    return this.inventoryService.createPurchaseOrder(ctx, dto);
  }

  @Get("purchase-order/:id")
  purchaseOrderById(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.inventoryService.getPurchaseOrder(ctx, id);
  }

  @Post("transfer")
  @Roles("tenant_owner", "branch_manager", "inventory_manager")
  transfer(@CurrentTenant() ctx: TenantContext, @Body() dto: StockTransferDto) {
    return this.inventoryService.transferStock(ctx, dto);
  }

  @Post("wastage")
  @Roles("tenant_owner", "branch_manager", "inventory_manager")
  wastage(@CurrentTenant() ctx: TenantContext, @Body() dto: WastageDto) {
    return this.inventoryService.createWastage(ctx, dto);
  }

  @Post("production/build")
  @Roles("tenant_owner", "branch_manager", "inventory_manager")
  productionBuild(@CurrentTenant() ctx: TenantContext, @Body() dto: ProductionBuildDto) {
    return this.inventoryService.createProductionBuild(ctx, dto);
  }

  @Get("lot-tracking")
  lotTracking(@CurrentTenant() ctx: TenantContext) {
    return this.inventoryService.getLotTracking(ctx);
  }
}
