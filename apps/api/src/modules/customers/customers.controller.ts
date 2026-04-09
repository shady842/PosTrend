import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { CreateCustomerDto, LoyaltyTransactionDto } from "./dto/customers.dto";
import { CustomersService } from "./customers.service";

@Controller()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get("customers")
  list(@CurrentTenant() ctx: TenantContext) {
    return this.customersService.listCustomers(ctx);
  }

  @Post("customers")
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateCustomerDto) {
    return this.customersService.createCustomer(ctx, dto);
  }

  @Get("customers/:id")
  getById(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.customersService.getCustomer(ctx, id);
  }

  @Post("loyalty/transaction")
  loyaltyTransaction(@CurrentTenant() ctx: TenantContext, @Body() dto: LoyaltyTransactionDto) {
    return this.customersService.loyaltyTransaction(ctx, dto);
  }
}
