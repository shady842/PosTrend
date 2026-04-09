import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantContext } from "../auth/types/tenant-context.type";
import { AccountingService } from "../accounting/accounting.service";
import { PrismaService } from "../database/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { OrdersService } from "../orders/orders.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { PostingService } from "../posting/posting.service";
import { AddPaymentDto, CreatePaymentDto, RefundPaymentDto, SplitPaymentDto } from "./dto/payments.dto";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly accountingService: AccountingService,
    private readonly inventoryService: InventoryService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly posting: PostingService
  ) {}

  async pay(orderId: string, dto: CreatePaymentDto, ctx: TenantContext) {
    return this.addPayment(ctx, {
      order_id: orderId,
      payment_method: dto.method,
      amount: dto.amount,
      idempotency_key: `legacy-${orderId}-${Date.now()}`,
      offline_status: "paid"
    });
  }

  async addPayment(ctx: TenantContext, dto: AddPaymentDto) {
    const order = await this.ordersService.getForTenant(dto.order_id, ctx);
    const existing = await this.prisma.payment.findFirst({
      where: { tenantId: ctx.tenant_id, idempotencyKey: dto.idempotency_key }
    });
    if (existing) {
      return this.getOrderPayments(ctx, dto.order_id);
    }

    const paidSoFar = await this.sumPaid(order.id);
    const due = Number(order.total) - paidSoFar;
    if (dto.amount > due + 0.0001) {
      throw new BadRequestException("Payment amount exceeds outstanding balance");
    }

    const status = dto.offline_status === "pending" ? "pending" : "paid";
    const payment = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (dto.customer_id) {
        await tx.order.update({
          where: { id: order.id },
          data: { customerId: dto.customer_id }
        });
      }
      const created = await tx.payment.create({
        data: {
          tenantId: order.tenantId,
          conceptId: order.conceptId,
          branchId: order.branchId,
          orderId: order.id,
          paymentMethod: dto.payment_method,
          amount: dto.amount,
          status,
          paidAt: status === "paid" ? new Date() : null,
          referenceId: dto.reference_id,
          deviceId: dto.device_id,
          idempotencyKey: dto.idempotency_key
        }
      });

      await tx.paymentAuditLog.create({
        data: {
          tenantId: order.tenantId,
          conceptId: order.conceptId,
          branchId: order.branchId,
          orderId: order.id,
          paymentId: created.id,
          action: created.paymentMethod === "cash" ? "cash_payment_added" : "payment_added",
          actorId: ctx.sub,
          metadata: {
            amount: dto.amount,
            status
          }
        }
      });

      if (status === "paid") {
        await this.accountingService.postOrderPayment(
          {
            tenantId: order.tenantId,
            conceptId: order.conceptId,
            branchId: order.branchId,
            orderId: order.id,
            total: Number(dto.amount),
            tax: Number(order.tax)
          },
          tx
        );
      }

      return created;
    });

    const outstanding = Math.max(0, Number(order.total) - (paidSoFar + Number(payment.amount)));
    if (status === "paid" && outstanding <= 0) {
      await this.posting.post(ctx, { type: "ORDER_PAID", order_id: order.id });
      const paidOrder = await this.prisma.order.findUnique({ where: { id: order.id } });
      if (paidOrder?.customerId) {
        const points = Math.max(0, Math.floor(Number(paidOrder.total)));
        if (points > 0) {
          await this.prisma.$transaction(async (tx) => {
            await tx.customer.update({
              where: { id: paidOrder.customerId! },
              data: { loyaltyPoints: { increment: points } }
            });
            await tx.loyaltyTransaction.create({
              data: {
                customerId: paidOrder.customerId!,
                points,
                reason: `paid_order:${paidOrder.id}`
              }
            });
          });
        }
      }
    }

    this.realtimeGateway.emitPosOrderUpdate(order.branchId, order.id);

    return {
      payment_id: payment.id,
      status: payment.status,
      order_id: order.id,
      amount: Number(payment.amount),
      outstanding
    };
  }

  async splitPayment(ctx: TenantContext, dto: SplitPaymentDto) {
    const result = [];
    for (const split of dto.splits) {
      result.push(
        await this.addPayment(ctx, {
          order_id: dto.order_id,
          payment_method: split.payment_method,
          amount: split.amount,
          idempotency_key: split.idempotency_key,
          reference_id: split.reference_id,
          device_id: split.device_id,
          customer_id: split.customer_id,
          offline_status: split.offline_status
        })
      );
    }
    return {
      order_id: dto.order_id,
      payments: result
    };
  }

  async refundPayment(ctx: TenantContext, dto: RefundPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: dto.payment_id,
        orderId: dto.order_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!payment) throw new NotFoundException("Payment not found");
    const refunded = await this.prisma.refund.aggregate({
      where: { paymentId: payment.id },
      _sum: { amount: true }
    });
    const refundable = Number(payment.amount) - Number(refunded._sum.amount || 0);
    if (dto.amount > refundable + 0.0001) {
      throw new BadRequestException("Refund amount exceeds paid amount");
    }

    const status = dto.manager_approved_by ? "completed" : "requested";
    const refund = await this.prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          branchId: ctx.branch_id,
          orderId: dto.order_id,
          paymentId: payment.id,
          amount: dto.amount,
          reason: dto.reason,
          status,
          processedBy: dto.manager_approved_by || null,
          processedAt: dto.manager_approved_by ? new Date() : null
        }
      });
      if (status === "completed") {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "refunded" }
        });
      }
      await tx.paymentAuditLog.create({
        data: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          branchId: ctx.branch_id,
          orderId: dto.order_id,
          paymentId: payment.id,
          action: "refund_created",
          actorId: ctx.sub,
          metadata: { amount: dto.amount, status, reason: dto.reason }
        }
      });
      return created;
    });
    return refund;
  }

  async getOrderPayments(ctx: TenantContext, orderId: string) {
    const order = await this.ordersService.getForTenant(orderId, ctx);
    const payments = await this.prisma.payment.findMany({
      where: {
        orderId: order.id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      },
      orderBy: { createdAt: "asc" }
    });
    const refunds = await this.prisma.refund.findMany({
      where: {
        orderId: order.id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      },
      orderBy: { createdAt: "asc" }
    });
    const paid = payments
      .filter((p) => p.status === "paid" || p.status === "refunded")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const refunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
    const effectivePaid = paid - refunded;
    const due = Math.max(0, Number(order.total) - effectivePaid);
    const paymentReadyState = due <= 0 ? "READY_TO_CLOSE" : "PENDING_PAYMENT";
    return {
      order_id: order.id,
      order_total: Number(order.total),
      paid_amount: effectivePaid,
      due_amount: due,
      payment_state: paymentReadyState,
      payments,
      refunds
    };
  }

  private async sumPaid(orderId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { orderId, status: "paid" }
    });
    return payments.reduce((s, p) => s + Number(p.amount), 0);
  }
}
