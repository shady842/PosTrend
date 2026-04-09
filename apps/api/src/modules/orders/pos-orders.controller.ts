import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import {
  AddItemPosDto,
  AddModifierDto,
  AddOrderNoteDto,
  ApplyDiscountDto,
  ApplyPromotionDto,
  CreateDiningTableDto,
  CreateSectionDto,
  OpenDeliveryOrderDto,
  OpenTableOrderDto,
  OpenTakeawayOrderDto,
  MonitorMoveDto,
  RemoveItemDto,
  SendKitchenDto,
  SplitOrderDto,
  MergeOrdersDto,
  TransferTableDto,
  UpdateDiningTableDto,
  UpdateSectionDto,
  UpdateQtyDto,
  VoidItemDto,
  VoidOrderDto
} from "./dto/pos-orders.dto";
import { OrdersService } from "./orders.service";

@Controller("pos/orders")
export class PosOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("open-table")
  openTable(@CurrentTenant() ctx: TenantContext, @Body() dto: OpenTableOrderDto) {
    return this.ordersService.openOrder(ctx, "DINE_IN", dto);
  }

  @Post("takeaway")
  takeaway(@CurrentTenant() ctx: TenantContext, @Body() dto: OpenTakeawayOrderDto) {
    return this.ordersService.openOrder(ctx, "TAKEAWAY", dto);
  }

  @Post("delivery")
  delivery(@CurrentTenant() ctx: TenantContext, @Body() dto: OpenDeliveryOrderDto) {
    return this.ordersService.openOrder(ctx, "DELIVERY", dto);
  }

  @Post("add-item")
  addItem(@CurrentTenant() ctx: TenantContext, @Body() dto: AddItemPosDto) {
    return this.ordersService.addPosItem(ctx, dto);
  }

  @Post("update-qty")
  updateQty(@CurrentTenant() ctx: TenantContext, @Body() dto: UpdateQtyDto) {
    return this.ordersService.updateQty(ctx, dto);
  }

  @Post("remove-item")
  removeItem(@CurrentTenant() ctx: TenantContext, @Body() dto: RemoveItemDto) {
    return this.ordersService.removeItem(ctx, dto);
  }

  @Post("add-modifier")
  addModifier(@CurrentTenant() ctx: TenantContext, @Body() dto: AddModifierDto) {
    return this.ordersService.addModifier(ctx, dto);
  }

  @Post("add-note")
  addNote(@CurrentTenant() ctx: TenantContext, @Body() dto: AddOrderNoteDto) {
    return this.ordersService.addOrderNote(ctx, dto);
  }

  @Post("apply-discount")
  applyDiscount(@CurrentTenant() ctx: TenantContext, @Body() dto: ApplyDiscountDto) {
    return this.ordersService.applyDiscount(ctx, dto);
  }

  @Post("apply-promotion")
  applyPromotion(@CurrentTenant() ctx: TenantContext, @Body() dto: ApplyPromotionDto) {
    return this.ordersService.applyPromotion(ctx, dto);
  }

  @Post("send-kitchen")
  sendKitchen(@CurrentTenant() ctx: TenantContext, @Body() dto: SendKitchenDto) {
    return this.ordersService.sendKitchen(dto.order_id, ctx);
  }

  @Post("transfer-table")
  transferTable(@CurrentTenant() ctx: TenantContext, @Body() dto: TransferTableDto) {
    return this.ordersService.transferTable(ctx, dto);
  }

  @Post("merge-orders")
  mergeOrders(@CurrentTenant() ctx: TenantContext, @Body() dto: MergeOrdersDto) {
    return this.ordersService.mergeOrders(ctx, dto.source_order_id, dto.target_order_id);
  }

  @Post("split")
  split(@CurrentTenant() ctx: TenantContext, @Body() dto: SplitOrderDto) {
    return this.ordersService.splitOrder(ctx, dto);
  }

  @Post("void-item")
  voidItem(@CurrentTenant() ctx: TenantContext, @Body() dto: VoidItemDto) {
    return this.ordersService.voidItem(ctx, dto);
  }

  @Post("void-order")
  voidOrder(@CurrentTenant() ctx: TenantContext, @Body() dto: VoidOrderDto) {
    return this.ordersService.voidOrder(ctx, dto);
  }

  @Get("active")
  active(@CurrentTenant() ctx: TenantContext) {
    return this.ordersService.activeOrders(ctx);
  }

  @Get("live")
  live(
    @CurrentTenant() ctx: TenantContext,
    @Query("branch_id") branchId?: string,
    @Query("station_id") stationId?: string
  ) {
    return this.ordersService.liveOrders(ctx, { branch_id: branchId, station_id: stationId });
  }

  @Post("monitor-move")
  monitorMove(@CurrentTenant() ctx: TenantContext, @Body() dto: MonitorMoveDto) {
    return this.ordersService.setMonitorColumn(ctx, dto);
  }

  @Get("sections")
  listSections(@CurrentTenant() ctx: TenantContext, @Query("branch_id") branchId?: string) {
    return this.ordersService.listSections(ctx, branchId);
  }

  @Post("sections")
  createSection(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateSectionDto) {
    return this.ordersService.createSection(ctx, dto);
  }

  @Patch("sections/:id")
  updateSection(@CurrentTenant() ctx: TenantContext, @Param("id") id: string, @Body() dto: UpdateSectionDto) {
    return this.ordersService.updateSection(ctx, id, dto);
  }

  @Get("tables")
  listTables(
    @CurrentTenant() ctx: TenantContext,
    @Query("branch_id") branchId?: string,
    @Query("floor_id") floorId?: string
  ) {
    return this.ordersService.listDiningTables(ctx, { branch_id: branchId, floor_id: floorId });
  }

  @Post("tables")
  createTable(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateDiningTableDto) {
    return this.ordersService.createDiningTable(ctx, dto);
  }

  @Patch("tables/:id")
  updateTable(@CurrentTenant() ctx: TenantContext, @Param("id") id: string, @Body() dto: UpdateDiningTableDto) {
    return this.ordersService.updateDiningTable(ctx, id, dto);
  }

  @Get("layout")
  layout(@CurrentTenant() ctx: TenantContext, @Query("branch_id") branchId?: string) {
    return this.ordersService.getTableLayout(ctx, branchId);
  }

  @Get(":id")
  getById(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.ordersService.getForTenant(id, ctx);
  }
}
