import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AccountingService } from "../accounting/accounting.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import { ForecastQueryDto } from "./dto/forecast.dto";

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService
  ) {}

  async forecastSales(ctx: TenantContext, q: ForecastQueryDto) {
    await this.runAutomations(ctx);
    const conceptId = this.scope(q.concept_id, ctx.concept_id, "concept_id");
    const branchId = this.scope(q.branch_id, ctx.branch_id, "branch_id");
    const horizon = q.horizon || "daily";

    let rows = await this.prisma.aiForecastSales.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        horizon,
        forecastDate: this.range(q.date_from, q.date_to)
      },
      orderBy: { forecastDate: "asc" }
    });

    if (!rows.length) {
      const baseline = await this.buildSalesBaseline(ctx, conceptId, branchId, horizon);
      rows = await this.prisma.$transaction(async (tx) => {
        const created = [];
        for (const b of baseline) {
          created.push(
            await tx.aiForecastSales.create({
              data: {
                tenantId: ctx.tenant_id,
                conceptId,
                branchId,
                horizon,
                forecastDate: b.forecast_date,
                predictedSales: b.predicted_sales,
                confidence: b.confidence,
                drivers: b.drivers as Prisma.InputJsonValue,
                modelVersion: "baseline-v1"
              }
            })
          );
        }
        return created;
      });
    }

    return rows.map((r) => ({
      forecast_date: r.forecastDate,
      predicted_sales: Number(r.predictedSales),
      confidence: Number(r.confidence),
      drivers: r.drivers || {}
    }));
  }

  async forecastInventory(ctx: TenantContext, q: ForecastQueryDto) {
    await this.runAutomations(ctx);
    const conceptId = this.scope(q.concept_id, ctx.concept_id, "concept_id");
    const branchId = this.scope(q.branch_id, ctx.branch_id, "branch_id");
    const existing = await this.prisma.aiForecastInventory.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        forecastDate: this.range(q.date_from, q.date_to)
      },
      orderBy: [{ forecastDate: "asc" }, { predictedDemandQty: "desc" }]
    });
    if (existing.length) {
      return existing.map((e) => ({
        forecast_date: e.forecastDate,
        inventory_item_id: e.inventoryItemId,
        predicted_demand_qty: Number(e.predictedDemandQty),
        predicted_stock_out_at: e.predictedStockOutAt,
        confidence: Number(e.confidence),
        drivers: e.drivers || {}
      }));
    }

    const inv = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId,
        OR: [{ branchId }, { branchId: null }]
      }
    });
    const rows: Prisma.AiForecastInventoryCreateManyInput[] = [];
    for (const item of inv) {
      const dailyDemand = Number(item.reorderPoint) / 7 || 0.5;
      const predictedDemandQty = Number((dailyDemand * 3).toFixed(3));
      const daysToOut = dailyDemand > 0 ? Number(item.stockLevel) / dailyDemand : 999;
      rows.push({
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        forecastDate: new Date(),
        inventoryItemId: item.id,
        predictedDemandQty,
        predictedStockOutAt:
          daysToOut <= 30 ? new Date(Date.now() + daysToOut * 24 * 60 * 60 * 1000) : null,
        confidence: 0.71,
        drivers: {
          stock_level: Number(item.stockLevel),
          reorder_point: Number(item.reorderPoint)
        } as Prisma.InputJsonValue
      });
    }
    if (rows.length) {
      await this.prisma.aiForecastInventory.createMany({ data: rows });
    }
    return rows.map((r) => ({
      forecast_date: r.forecastDate,
      inventory_item_id: r.inventoryItemId,
      predicted_demand_qty: Number(r.predictedDemandQty),
      predicted_stock_out_at: r.predictedStockOutAt,
      confidence: Number(r.confidence),
      drivers: r.drivers
    }));
  }

  async reorder(ctx: TenantContext, q: ForecastQueryDto) {
    await this.runAutomations(ctx);
    const conceptId = this.scope(q.concept_id, ctx.concept_id, "concept_id");
    const branchId = this.scope(q.branch_id, ctx.branch_id, "branch_id");
    const existing = await this.prisma.aiReorderRecommendation.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        generatedAt: this.range(q.date_from, q.date_to)
      },
      orderBy: { generatedAt: "desc" }
    });
    const alerts = await this.buildAlerts(ctx);
    return existing.map((e) => ({
      generated_at: e.generatedAt,
      inventory_item_id: e.inventoryItemId,
      supplier_id: e.supplierId,
      suggested_reorder_qty: Number(e.recommendedQty),
      reason: e.reason,
      confidence: Number(e.confidence),
      status: e.status,
      alerts
    }));
  }

  async applyReorder(ctx: TenantContext, inventoryItemId: string) {
    const row = await this.prisma.aiReorderRecommendation.findFirst({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id,
        inventoryItemId
      },
      orderBy: { generatedAt: "desc" }
    });
    if (!row) throw new BadRequestException("Recommendation not found");
    return this.prisma.aiReorderRecommendation.update({
      where: { id: row.id },
      data: { status: "applied" }
    });
  }

  async dynamicPricing(ctx: TenantContext, q: ForecastQueryDto) {
    await this.runAutomations(ctx);
    const conceptId = this.scope(q.concept_id, ctx.concept_id, "concept_id");
    const branchId = this.scope(q.branch_id, ctx.branch_id, "branch_id");
    const existing = await this.prisma.aiDynamicPricing.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId,
        branchId
      },
      orderBy: { generatedAt: "desc" }
    });
    if (existing.length) {
      return existing.map((r) => ({
        menu_item_id: r.menuItemId,
        current_price: Number(r.currentPrice),
        recommended_price: Number(r.recommendedPrice),
        expected_lift_pct: Number(r.expectedLiftPct),
        reason: r.reason,
        confidence: Number(r.confidence)
      }));
    }

    const items = await this.prisma.menuItem.findMany({
      where: { tenantId: ctx.tenant_id, conceptId, isActive: true },
      include: {
        orderItems: {
          where: { branchId, status: { not: "VOIDED" } }
        }
      }
    });
    const rows: Prisma.AiDynamicPricingCreateManyInput[] = [];
    for (const item of items) {
      const qty = item.orderItems.reduce((s, oi) => s + Number(oi.qty), 0);
      const current = Number(item.basePrice);
      const factor = qty < 10 ? 0.95 : qty > 100 ? 1.05 : 1.0;
      const recommended = Number((current * factor).toFixed(2));
      rows.push({
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        menuItemId: item.id,
        currentPrice: current,
        recommendedPrice: recommended,
        expectedLiftPct: factor > 1 ? 0.08 : factor < 1 ? 0.03 : 0.01,
        reason: factor > 1 ? "high_demand_signal" : factor < 1 ? "low_demand_signal" : "stable_demand",
        confidence: 0.66
      });
    }
    await this.prisma.aiDynamicPricing.createMany({ data: rows });
    return rows.map((r) => ({
      menu_item_id: r.menuItemId,
      current_price: Number(r.currentPrice),
      recommended_price: Number(r.recommendedPrice),
      expected_lift_pct: Number(r.expectedLiftPct),
      reason: r.reason,
      confidence: Number(r.confidence)
    }));
  }

  async wastePrediction(ctx: TenantContext, q: ForecastQueryDto) {
    await this.runAutomations(ctx);
    const conceptId = this.scope(q.concept_id, ctx.concept_id, "concept_id");
    const branchId = this.scope(q.branch_id, ctx.branch_id, "branch_id");
    const existing = await this.prisma.aiWastePrediction.findMany({
      where: { tenantId: ctx.tenant_id, conceptId, branchId },
      orderBy: { generatedAt: "desc" }
    });
    if (existing.length) {
      return existing.map((r) => ({
        inventory_item_id: r.inventoryItemId,
        predicted_waste_qty: Number(r.predictedWasteQty),
        estimated_waste_cost: Number(r.estimatedWasteCost),
        risk_level: r.riskLevel,
        recommendation: r.recommendation,
        confidence: Number(r.confidence)
      }));
    }

    const recentWaste = await this.prisma.wastageEntry.groupBy({
      by: ["inventoryItemId"],
      where: { branchId },
      _sum: { quantity: true }
    });
    const rows: Prisma.AiWastePredictionCreateManyInput[] = recentWaste.map((w) => {
      const wasteQty = Number(w._sum.quantity || 0);
      const risk = wasteQty > 20 ? "high" : wasteQty > 5 ? "medium" : "low";
      return {
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        inventoryItemId: w.inventoryItemId,
        predictedWasteQty: Number((wasteQty * 1.1).toFixed(3)),
        estimatedWasteCost: Number((wasteQty * 1.1 * 2).toFixed(2)),
        riskLevel: risk,
        recommendation: risk === "high" ? "reduce_batch_size_and_reorder_frequency" : "monitor",
        confidence: 0.64
      };
    });
    if (rows.length) await this.prisma.aiWastePrediction.createMany({ data: rows });
    return rows.map((r) => ({
      inventory_item_id: r.inventoryItemId,
      predicted_waste_qty: Number(r.predictedWasteQty),
      estimated_waste_cost: Number(r.estimatedWasteCost),
      risk_level: r.riskLevel,
      recommendation: r.recommendation,
      confidence: Number(r.confidence)
    }));
  }

  private scope(requested: string | undefined, scoped: string, key: string) {
    if (!requested) return scoped;
    if (requested !== scoped) throw new BadRequestException(`${key} out of scope`);
    return requested;
  }

  private range(from?: string, to?: string) {
    if (!from && !to) return undefined;
    const out: { gte?: Date; lte?: Date } = {};
    if (from) out.gte = new Date(from);
    if (to) out.lte = new Date(to);
    return out;
  }

  private async buildSalesBaseline(
    ctx: TenantContext,
    conceptId: string,
    branchId: string,
    horizon: string
  ) {
    const lookbackStart = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        status: { notIn: ["VOIDED", "voided"] },
        createdAt: { gte: lookbackStart }
      }
    });
    const byDay = new Map<string, number>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + Number(o.total));
    }
    const values = [...byDay.values()];
    const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const variance =
      values.length > 1 ? values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1) : 0;
    const confidence = Math.max(0.5, Math.min(0.95, 1 - Math.min(1, Math.sqrt(variance) / (avg || 1))));

    const stepHours = horizon === "intraday" ? 6 : 24;
    const points = horizon === "intraday" ? 4 : 7;
    const out = [];
    for (let i = 1; i <= points; i++) {
      out.push({
        forecast_date: new Date(Date.now() + i * stepHours * 60 * 60 * 1000),
        predicted_sales: Number((avg * (1 + (i % 3) * 0.02)).toFixed(2)),
        confidence: Number(confidence.toFixed(4)),
        drivers: {
          seasonal: "weekday_pattern",
          trend: "last_28d_average",
          promo_impact: "from_forecast_signals"
        }
      });
    }
    return out;
  }

  private async runAutomations(ctx: TenantContext) {
    await this.ensureNotificationPreferences(ctx);
    await this.autoGenerateReorders(ctx);
    await this.autoGeneratePayroll(ctx);
    await this.autoPostDepreciation(ctx);
    await this.autoMatchBillingPayments(ctx);
  }

  private async ensureNotificationPreferences(ctx: TenantContext) {
    await this.prisma.notificationPreference.upsert({
      where: { tenantId: ctx.tenant_id },
      create: {
        tenantId: ctx.tenant_id,
        channels: { in_app: true } as Prisma.InputJsonValue
      },
      update: {}
    });
  }

  private async autoGenerateReorders(ctx: TenantContext) {
    const deficits = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        OR: [{ branchId: ctx.branch_id }, { branchId: null }]
      }
    });
    for (const item of deficits) {
      const deficit = Number(item.reorderPoint) - Number(item.stockLevel);
      if (deficit <= 0) continue;
      const supplierId = await this.recommendSupplierId(ctx, item.id);
      const exists = await this.prisma.aiReorderRecommendation.findFirst({
        where: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          branchId: ctx.branch_id,
          inventoryItemId: item.id,
          generatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });
      if (!exists) {
        await this.prisma.aiReorderRecommendation.create({
          data: {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: ctx.branch_id,
            inventoryItemId: item.id,
            supplierId,
            recommendedQty: Number((deficit * 1.3).toFixed(3)),
            reason: "below_reorder_point",
            confidence: 0.7,
            status: "suggested"
          }
        });
      }
    }
  }

  private async autoGeneratePayroll(ctx: TenantContext) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id,
        status: "active"
      }
    });
    for (const e of employees) {
      const exists = await this.prisma.payrollRecord.findFirst({
        where: { employeeId: e.id, periodStart, periodEnd }
      });
      if (exists) continue;
      const attendance = await this.prisma.attendanceLog.count({
        where: { employeeId: e.id, branchId: ctx.branch_id, checkIn: { gte: periodStart, lte: periodEnd } }
      });
      const leaves = await this.prisma.leaveRequest.count({
        where: {
          employeeId: e.id,
          branchId: ctx.branch_id,
          status: "approved",
          startDate: { lte: periodEnd },
          endDate: { gte: periodStart }
        }
      });
      const gross = attendance * 50;
      const deductions = leaves * 20;
      const net = Math.max(gross - deductions, 0);
      await this.prisma.payrollRecord.create({
        data: {
          employeeId: e.id,
          branchId: ctx.branch_id,
          periodStart,
          periodEnd,
          grossSalary: gross,
          deductions,
          netSalary: net,
          status: "draft"
        }
      });
    }
  }

  private async autoPostDepreciation(ctx: TenantContext) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const assets = await this.prisma.asset.findMany({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id, status: "active" }
    });
    for (const asset of assets) {
      const posted = await this.prisma.assetTransaction.findFirst({
        where: {
          assetId: asset.id,
          transactionType: "depreciation",
          date: { gte: monthStart }
        }
      });
      if (posted) continue;
      const amount =
        asset.depreciationMethod === "straight-line"
          ? Number((Number(asset.purchaseCost) / asset.usefulLifeMonths).toFixed(2))
          : Number((Number(asset.netBookValue) * 0.1).toFixed(2));
      if (amount <= 0 || amount > Number(asset.netBookValue)) continue;
      await this.prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepreciation: { increment: amount },
            netBookValue: { decrement: amount },
            transactions: {
              create: { transactionType: "depreciation", amount, date: new Date() }
            }
          }
        });
        await this.accountingService.postAssetDepreciation(
          {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: ctx.branch_id,
            assetId: asset.id,
            amount,
            actorId: "system"
          },
          tx
        );
      });
    }
  }

  private async autoMatchBillingPayments(ctx: TenantContext) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id }
    });
    for (const account of accounts) {
      const txs = await this.prisma.bankTransaction.findMany({
        where: { bankAccountId: account.id, status: "unmatched" }
      });
      for (const tx of txs) {
        if (!tx.reference) continue;
        const bill = await this.prisma.apBill.findFirst({
          where: {
            tenantId: ctx.tenant_id,
            branchId: ctx.branch_id,
            billNo: tx.reference,
            amount: tx.amount
          }
        });
        if (!bill) continue;
        await this.prisma.bankTransaction.update({
          where: { id: tx.id },
          data: { status: "matched", matchedRefType: "bill", matchedRefId: bill.id }
        });
        await this.accountingService.postBankReconciliation({
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          branchId: ctx.branch_id,
          transactionId: tx.id,
          amount: Number(tx.amount),
          type: tx.type as "credit" | "debit",
          matchedRefType: "bill",
          matchedRefId: bill.id,
          actorId: "system"
        });
      }
    }
  }

  private async buildAlerts(ctx: TenantContext) {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { tenantId: ctx.tenant_id }
    });
    const alerts: string[] = [];
    if (!prefs) return alerts;
    if (prefs.lowStockEnabled) {
      const inventory = await this.prisma.inventoryItem.findMany({
        where: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          OR: [{ branchId: ctx.branch_id }, { branchId: null }]
        }
      });
      const low = inventory.filter((row) => Number(row.stockLevel) <= Number(row.reorderPoint)).length;
      if (low > 0) alerts.push("low_stock");
    }
    if (prefs.overdueInvoicesEnabled) {
      const overdue = await this.prisma.apBill.count({
        where: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id,
          status: { in: ["draft", "posted"] },
          dueDate: { lt: new Date() }
        }
      });
      if (overdue > 0) alerts.push("overdue_invoices");
    }
    if (prefs.payrollExceptionsEnabled) {
      const payrollDrafts = await this.prisma.payrollRecord.count({
        where: { branchId: ctx.branch_id, status: "draft" }
      });
      if (payrollDrafts > 0) alerts.push("payroll_exceptions");
    }
    if (prefs.accountingVarianceEnabled) {
      const variance = await this.prisma.dayClosure.findFirst({
        where: { branchId: ctx.branch_id, cashVariance: { not: 0 } },
        orderBy: { closedAt: "desc" }
      });
      if (variance) alerts.push("accounting_variance");
    }
    return alerts;
  }

  private async recommendSupplierId(ctx: TenantContext, inventoryItemId: string) {
    const recentLine = await this.prisma.poLine.findFirst({
      where: {
        inventoryItemId,
        purchaseOrder: { tenantId: ctx.tenant_id, branchId: ctx.branch_id }
      },
      include: { purchaseOrder: true },
      orderBy: { purchaseOrder: { createdAt: "desc" } }
    });
    return recentLine?.purchaseOrder.supplierId || null;
  }
}
