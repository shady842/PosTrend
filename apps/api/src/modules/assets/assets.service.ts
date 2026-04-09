import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountingService } from "../accounting/accounting.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import {
  CreateAssetCategoryDto,
  CreateAssetDto,
  DepreciateAssetsDto,
  DisposeAssetDto
} from "./dto/assets.dto";

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService
  ) {}

  createCategory(ctx: TenantContext, dto: CreateAssetCategoryDto) {
    return this.prisma.assetCategory.create({
      data: {
        tenantId: ctx.tenant_id,
        name: dto.name,
        description: dto.description
      }
    });
  }

  async create(ctx: TenantContext, dto: CreateAssetDto) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id: dto.category_id, tenantId: ctx.tenant_id }
    });
    if (!category) throw new NotFoundException("Asset category not found");
    const created = await this.prisma.asset.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        name: dto.name,
        categoryId: dto.category_id,
        purchaseDate: new Date(dto.purchase_date),
        purchaseCost: dto.purchase_cost,
        usefulLifeMonths: dto.useful_life_months,
        depreciationMethod: dto.depreciation_method,
        accumulatedDepreciation: 0,
        netBookValue: dto.purchase_cost,
        status: "active",
        transactions: {
          create: {
            transactionType: "purchase",
            amount: dto.purchase_cost,
            date: new Date(dto.purchase_date)
          }
        }
      },
      include: { category: true }
    });

    return created;
  }

  async getOne(ctx: TenantContext, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId: ctx.tenant_id, branchId: ctx.branch_id },
      include: { category: true, transactions: { orderBy: { date: "asc" } } }
    });
    if (!asset) throw new NotFoundException("Asset not found");
    return asset;
  }

  async depreciate(ctx: TenantContext, dto: DepreciateAssetsDto) {
    const branchId = dto.branch_id || ctx.branch_id;
    const asOf = dto.as_of_date ? new Date(dto.as_of_date) : new Date();
    const assets = await this.prisma.asset.findMany({
      where: { tenantId: ctx.tenant_id, branchId, status: "active" }
    });
    let processed = 0;
    const results: Array<{ asset_id: string; amount: number; net_book_value: number }> = [];
    for (const asset of assets) {
      const amount = this.computeMonthlyDepreciation(
        Number(asset.netBookValue),
        Number(asset.purchaseCost),
        asset.usefulLifeMonths,
        asset.depreciationMethod
      );
      if (amount <= 0) continue;
      const updated = await this.prisma.$transaction(async (tx) => {
        const nextAccum = Number((Number(asset.accumulatedDepreciation) + amount).toFixed(2));
        const nextNbv = Math.max(Number((Number(asset.netBookValue) - amount).toFixed(2)), 0);
        const row = await tx.asset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepreciation: nextAccum,
            netBookValue: nextNbv,
            transactions: {
              create: {
                transactionType: "depreciation",
                amount,
                date: asOf
              }
            }
          }
        });
        await this.accountingService.postAssetDepreciation(
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId,
            assetId: asset.id,
            amount,
            actorId: ctx.sub
          },
          tx
        );
        return row;
      });
      processed += 1;
      results.push({
        asset_id: updated.id,
        amount,
        net_book_value: Number(updated.netBookValue)
      });
    }
    return { processed, as_of_date: asOf, rows: results };
  }

  async dispose(ctx: TenantContext, dto: DisposeAssetDto) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: dto.asset_id, tenantId: ctx.tenant_id, branchId: ctx.branch_id }
    });
    if (!asset) throw new NotFoundException("Asset not found");
    if (asset.status === "disposed") {
      throw new BadRequestException("Asset already disposed");
    }
    const disposalDate = dto.disposal_date ? new Date(dto.disposal_date) : new Date();
    const nbv = Number(asset.netBookValue);
    const proceeds = Number(dto.proceeds);
    const gainLoss = Number((proceeds - nbv).toFixed(2));
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: "disposed",
          netBookValue: 0,
          transactions: {
            create: {
              transactionType: "disposal",
              amount: proceeds,
              date: disposalDate
            }
          }
        }
      });
      await this.accountingService.postAssetDisposal(
        {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          branchId: ctx.branch_id,
          assetId: asset.id,
          proceeds,
          netBookValue: nbv,
          actorId: ctx.sub
        },
        tx
      );
      return row;
    });
    return {
      id: updated.id,
      status: updated.status,
      proceeds,
      net_book_value_before_disposal: nbv,
      gain_loss: gainLoss
    };
  }

  private computeMonthlyDepreciation(
    netBookValue: number,
    purchaseCost: number,
    usefulLifeMonths: number,
    method: string
  ) {
    if (netBookValue <= 0) return 0;
    if (method === "straight-line") {
      const monthly = purchaseCost / usefulLifeMonths;
      return Number(Math.min(monthly, netBookValue).toFixed(2));
    }
    if (method === "reducing_balance") {
      const annualRate = 2 / Math.max(usefulLifeMonths / 12, 1);
      const monthlyRate = annualRate / 12;
      const amount = netBookValue * monthlyRate;
      return Number(Math.min(amount, netBookValue).toFixed(2));
    }
    return 0;
  }
}
