import { Body, Controller, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { CreatePaymentDto } from "./dto/payments.dto";
import { PaymentsService } from "./payments.service";

@Controller("orders")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(":id/payments")
  pay(@Param("id") id: string, @Body() dto: CreatePaymentDto, @CurrentTenant() ctx: TenantContext) {
    return this.paymentsService.pay(id, dto, ctx);
  }

  @Post(":id/refunds")
  @Roles("tenant_owner", "branch_manager")
  refund(@Param("id") id: string) {
    return { order_id: id, status: "refunded" };
  }

  @Post(":id/void")
  @Roles("tenant_owner", "branch_manager")
  voidOrder(@Param("id") id: string) {
    return { order_id: id, status: "voided" };
  }
}
