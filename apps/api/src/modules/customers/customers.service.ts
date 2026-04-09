import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import { CreateCustomerDto, LoyaltyTransactionDto } from "./dto/customers.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  listCustomers(ctx: TenantContext) {
    return this.prisma.customer.findMany({
      where: { tenantId: ctx.tenant_id },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async createCustomer(ctx: TenantContext, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        tenantId: ctx.tenant_id,
        fullName: dto.full_name,
        contactInfo: (dto.contact_info || {}) as Prisma.InputJsonValue
      }
    });
  }

  async getCustomer(ctx: TenantContext, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: ctx.tenant_id }
    });
    if (!customer) throw new NotFoundException("Customer not found");
    return customer;
  }

  async loyaltyTransaction(ctx: TenantContext, dto: LoyaltyTransactionDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customer_id, tenantId: ctx.tenant_id }
    });
    if (!customer) throw new NotFoundException("Customer not found");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { increment: dto.points } }
      });
      const trx = await tx.loyaltyTransaction.create({
        data: {
          customerId: customer.id,
          points: dto.points,
          reason: dto.reason
        }
      });
      await tx.promoAuditLog.create({
        data: {
          actorId: ctx.sub,
          action: "loyalty_transaction_created",
          metadata: { customer_id: customer.id, points: dto.points, reason: dto.reason }
        }
      });
      return { customer_id: updated.id, loyalty_points: updated.loyaltyPoints, transaction_id: trx.id };
    });
  }
}
