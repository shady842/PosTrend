import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { CreateSupplierDto, SupplierBillDto, SupplierPurchaseOrderDto } from "./dto/suppliers.dto";
import { SuppliersService } from "./suppliers.service";

@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.createSupplier(ctx, dto);
  }

  @Get()
  list(@CurrentTenant() ctx: TenantContext) {
    return this.suppliersService.listSuppliers(ctx);
  }

  @Get(":id")
  getById(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.suppliersService.getSupplier(ctx, id);
  }

  @Post(":id/purchase-order")
  createPurchaseOrder(
    @CurrentTenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body() dto: SupplierPurchaseOrderDto
  ) {
    return this.suppliersService.createSupplierPurchaseOrder(ctx, id, dto);
  }

  @Post(":id/bill")
  createBill(@CurrentTenant() ctx: TenantContext, @Param("id") id: string, @Body() dto: SupplierBillDto) {
    return this.suppliersService.createSupplierBill(ctx, id, dto);
  }

  @Get(":id/statement")
  statement(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.suppliersService.getSupplierStatement(ctx, id);
  }
}
