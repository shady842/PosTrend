import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import { CreatePromotionDto } from "./dto/promotions.dto";

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPromotion(ctx: TenantContext, dto: CreatePromotionDto) {
    const promotion = await this.prisma.promotion.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: dto.branch_id || ctx.branch_id,
        name: dto.name,
        promoType: dto.promo_type,
        scope: dto.scope,
        startDate: new Date(dto.start_date),
        endDate: new Date(dto.end_date),
        status: dto.status,
        rules: {
          create: dto.rules.map((rule) => ({
            condition: rule.condition as Prisma.InputJsonValue,
            effect: rule.effect as Prisma.InputJsonValue
          }))
        }
      },
      include: { rules: true }
    });
    await this.prisma.promoAuditLog.create({
      data: {
        promotionId: promotion.id,
        actorId: ctx.sub,
        action: "promotion_created",
        metadata: { promo_type: dto.promo_type, scope: dto.scope } as Prisma.InputJsonValue
      }
    });
    return promotion;
  }

  async getPromotion(ctx: TenantContext, id: string) {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id, tenantId: ctx.tenant_id, branchId: ctx.branch_id },
      include: { rules: true }
    });
    if (!promotion) throw new NotFoundException("Promotion not found");
    return promotion;
  }
}
