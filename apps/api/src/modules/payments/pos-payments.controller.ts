import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { AddPaymentDto, RefundPaymentDto, SplitPaymentDto } from "./dto/payments.dto";
import { PaymentsService } from "./payments.service";

@Controller("pos/payments")
export class PosPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("add")
  add(@CurrentTenant() ctx: TenantContext, @Body() dto: AddPaymentDto) {
    return this.paymentsService.addPayment(ctx, dto);
  }

  @Post("split")
  split(@CurrentTenant() ctx: TenantContext, @Body() dto: SplitPaymentDto) {
    return this.paymentsService.splitPayment(ctx, dto);
  }

  @Post("refund")
  refund(@CurrentTenant() ctx: TenantContext, @Body() dto: RefundPaymentDto) {
    return this.paymentsService.refundPayment(ctx, dto);
  }

  @Get(":order_id")
  getByOrder(@CurrentTenant() ctx: TenantContext, @Param("order_id") orderId: string) {
    return this.paymentsService.getOrderPayments(ctx, orderId);
  }
}
