import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { AccountingService } from "../accounting/accounting.service";
import { PrismaService } from "../database/prisma.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import {
  CreateInventoryItemDto,
  ProductionBuildDto,
  CreatePurchaseOrderDto,
  StockAdjustmentDto,
  StockCountDto,
  StockTransferDto,
  WastageDto
} from "./dto/inventory.dto";
import { PostingService } from "../posting/posting.service";

type ConsumptionContext = {
  tenantId: string;
  conceptId: string;
  branchId: string;
  orderId: string;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly posting: PostingService
  ) {}

  async consumeForOrder(
    ctx: ConsumptionContext,
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const existing = await db.stockLedger.count({
      where: { orderId: ctx.orderId, txnType: "deduction" }
    });
    if (existing > 0) return { already_deducted: true };

    const orderItems = await db.orderItem.findMany({
      where: { orderId: ctx.orderId, status: { not: "VOIDED" } }
    });
    let cogs = 0;
    for (const orderItem of orderItems) {
      const recipe = await db.recipe.findFirst({
        where: {
          menuItemId: orderItem.menuItemId,
          tenantId: ctx.tenantId,
          conceptId: ctx.conceptId,
          OR: [{ branchId: ctx.branchId }, { branchId: null }]
        },
        include: { lines: true }
      });
      if (!recipe) continue;
      for (const line of recipe.lines) {
        const required = Number(line.qtyPerItem) * Number(orderItem.qty);
        const inv = await db.inventoryItem.findFirst({
          where: {
            id: line.inventoryItemId,
            tenantId: ctx.tenantId,
            conceptId: ctx.conceptId,
            OR: [{ branchId: ctx.branchId }, { branchId: null }]
          }
        });
        if (!inv) continue;
        if (Number(inv.stockLevel) < required) {
          throw new BadRequestException(`Insufficient stock for ${inv.name}`);
        }

        await db.inventoryItem.update({
          where: { id: inv.id },
          data: {
            stockLevel: {
              decrement: required
            }
          }
        });
        await db.stockLedger.create({
          data: {
            inventoryItemId: inv.id,
            branchId: ctx.branchId,
            txnType: "deduction",
            qty: -required,
            orderId: ctx.orderId,
            reference: "order_close"
          }
        });
        await this.consumeLotsFefo(
          line.inventoryItemId,
          ctx.branchId,
          required,
          `order_close:${ctx.orderId}`,
          db
        );
        const unitCost = await this.resolveAverageUnitCost(
          ctx.tenantId,
          ctx.branchId,
          line.inventoryItemId,
          db
        );
        cogs += required * unitCost;
        if (Number(inv.stockLevel) - required <= Number(inv.reorderPoint)) {
          await db.stockLedger.create({
            data: {
              inventoryItemId: inv.id,
              branchId: ctx.branchId,
              txnType: "adjustment",
              qty: 0,
              orderId: ctx.orderId,
              reference: "low_stock_alert"
            }
          });
        }
      }
    }
    await this.accountingService.postCogsForOrder(
      {
        tenantId: ctx.tenantId,
        conceptId: ctx.conceptId,
        branchId: ctx.branchId,
        orderId: ctx.orderId,
        cogs: Number(cogs.toFixed(2))
      },
      db
    );
    return { deducted: true };
  }

  /**
   * Weighted average purchase cost (branch-scoped fallback to tenant-wide).
   * This hardens COGS to valuation amount instead of raw consumed quantity.
   */
  private async resolveAverageUnitCost(
    tenantId: string,
    branchId: string,
    inventoryItemId: string,
    db: Prisma.TransactionClient | PrismaService
  ) {
    const branchLines = await db.poLine.findMany({
      where: {
        inventoryItemId,
        purchaseOrder: {
          tenantId,
          branchId,
          status: "received"
        }
      },
      select: { quantity: true, unitPrice: true },
      take: 60
    });
    const lines =
      branchLines.length > 0
        ? branchLines
        : await db.poLine.findMany({
            where: {
              inventoryItemId,
              purchaseOrder: {
                tenantId,
                status: "received"
              }
            },
            select: { quantity: true, unitPrice: true },
            take: 60
          });
    if (!lines.length) return 1;
    const totals = lines.reduce(
      (acc, line) => {
        const q = Number(line.quantity);
        const p = Number(line.unitPrice);
        acc.qty += q;
        acc.value += q * p;
        return acc;
      },
      { qty: 0, value: 0 }
    );
    if (totals.qty <= 0) return 1;
    return Number((totals.value / totals.qty).toFixed(6));
  }

  listUoms() {
    return this.prisma.uom.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, conversionFactor: true }
    });
  }

  async createItem(ctx: TenantContext, dto: CreateInventoryItemDto) {
    const name = dto.name.trim();
    const sku = dto.sku.trim();
    if (!name.length || !sku.length) {
      throw new BadRequestException("Name and SKU are required");
    }
    if (dto.uom_id) {
      const uom = await this.prisma.uom.findFirst({ where: { id: dto.uom_id } });
      if (!uom) throw new BadRequestException("UOM not found");
    }
    const branchId = dto.concept_wide ? null : ctx.branch_id;
    const reorder = dto.reorder_point ?? 0;
    const stock = dto.stock_level ?? 0;
    return this.prisma.inventoryItem.create({
      data: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId,
        name,
        sku,
        uomId: dto.uom_id || null,
        reorderPoint: reorder,
        stockLevel: stock
      },
      include: { uom: true }
    });
  }

  getItems(ctx: TenantContext) {
    return this.prisma.inventoryItem.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        OR: [{ branchId: ctx.branch_id }, { branchId: null }]
      },
      include: { uom: true },
      orderBy: { name: "asc" }
    });
  }

  listPurchaseOrders(ctx: TenantContext) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id },
      include: { lines: { include: { inventoryItem: true } }, supplier: true },
      orderBy: { createdAt: "desc" }
    });
  }

  listTransfers(ctx: TenantContext) {
    return this.prisma.stockTransfer.findMany({
      where: {
        OR: [{ fromBranchId: ctx.branch_id }, { toBranchId: ctx.branch_id }],
        inventoryItem: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id
        }
      },
      include: { inventoryItem: true },
      orderBy: { createdAt: "desc" }
    });
  }

  listWastage(ctx: TenantContext) {
    return this.prisma.wastageEntry.findMany({
      where: { branchId: ctx.branch_id },
      include: { inventoryItem: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async getInsights(ctx: TenantContext) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        OR: [{ branchId: ctx.branch_id }, { branchId: null }]
      },
      select: { id: true, name: true, stockLevel: true, reorderPoint: true, sku: true }
    });
    const itemIds = items.map((i) => i.id);
    const lastPrices = new Map<string, number>();
    if (itemIds.length) {
      const lines = await this.prisma.poLine.findMany({
        where: { inventoryItemId: { in: itemIds } },
        include: { purchaseOrder: true },
        orderBy: { purchaseOrder: { createdAt: "desc" } }
      });
      for (const line of lines) {
        if (!lastPrices.has(line.inventoryItemId)) {
          lastPrices.set(line.inventoryItemId, Number(line.unitPrice));
        }
      }
    }
    let totalValue = 0;
    const valuation = items.map((i) => {
      const unit = lastPrices.get(i.id) ?? 0;
      const stock = Number(i.stockLevel);
      const value = stock * unit;
      totalValue += value;
      return {
        id: i.id,
        name: i.name,
        sku: i.sku,
        stock_level: stock,
        reorder_point: Number(i.reorderPoint),
        unit_price: unit,
        line_value: value,
        low_stock: stock <= Number(i.reorderPoint)
      };
    });
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ledgers = await this.prisma.stockLedger.findMany({
      where: {
        branchId: ctx.branch_id,
        txnType: "deduction",
        createdAt: { gte: since }
      },
      include: { inventoryItem: true }
    });
    const byDay = new Map<string, number>();
    const byItem = new Map<string, { name: string; qty: number }>();
    for (const l of ledgers) {
      const d = l.createdAt.toISOString().slice(0, 10);
      const q = Math.abs(Number(l.qty));
      byDay.set(d, (byDay.get(d) || 0) + q);
      const id = l.inventoryItemId;
      const cur = byItem.get(id) || { name: l.inventoryItem.name, qty: 0 };
      cur.qty += q;
      byItem.set(id, cur);
    }
    const consumption_by_day = [...byDay.entries()]
      .map(([date, qty]) => ({ date, qty }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const top_consumed = [...byItem.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((x) => ({ name: x.name, qty: x.qty }));
    return {
      total_stock_value: Number(totalValue.toFixed(2)),
      valuation,
      consumption_by_day,
      top_consumed
    };
  }

  getStockLevels(ctx: TenantContext) {
    return this.prisma.inventoryItem.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        OR: [{ branchId: ctx.branch_id }, { branchId: null }]
      },
      select: {
        id: true,
        name: true,
        stockLevel: true,
        reorderPoint: true,
        branchId: true
      },
      orderBy: { name: "asc" }
    });
  }

  async adjustStock(ctx: TenantContext, dto: StockAdjustmentDto) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id: dto.inventory_item_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        OR: [{ branchId: ctx.branch_id }, { branchId: null }]
      }
    });
    if (!item) throw new BadRequestException("Inventory item not found");
    const newQty = Number(item.stockLevel) + Number(dto.qty);
    if (newQty < 0) throw new BadRequestException("Negative stock is not allowed");
    await this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: { stockLevel: newQty }
    });
    await this.prisma.stockAdjustment.create({
      data: {
        inventoryItemId: item.id,
        branchId: ctx.branch_id,
        qty: dto.qty,
        reason: dto.reason,
        adjustedBy: dto.adjusted_by
      }
    });
    await this.prisma.stockLedger.create({
      data: {
        inventoryItemId: item.id,
        branchId: ctx.branch_id,
        txnType: "adjustment",
        qty: dto.qty,
        reference: dto.reason
      }
    });
    return { status: "applied", item_id: item.id, stock_level: newQty };
  }

  async stockCount(ctx: TenantContext, dto: StockCountDto) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id: dto.inventory_item_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        OR: [{ branchId: ctx.branch_id }, { branchId: null }]
      }
    });
    if (!item) throw new BadRequestException("Inventory item not found");
    const delta = Number(dto.counted_qty) - Number(item.stockLevel);
    await this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: { stockLevel: dto.counted_qty }
    });
    await this.prisma.stockCount.create({
      data: {
        inventoryItemId: item.id,
        branchId: ctx.branch_id,
        countedQty: dto.counted_qty
      }
    });
    await this.prisma.stockLedger.create({
      data: {
        inventoryItemId: item.id,
        branchId: ctx.branch_id,
        txnType: "adjustment",
        qty: delta,
        reference: "stock_count"
      }
    });
    return { status: "counted", item_id: item.id, counted_qty: dto.counted_qty, delta };
  }

  async createPurchaseOrder(ctx: TenantContext, dto: CreatePurchaseOrderDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplier_id, tenantId: ctx.tenant_id }
    });
    if (!supplier) throw new NotFoundException("Supplier not found");
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id,
          supplierId: dto.supplier_id,
          poNumber: dto.po_number,
          status: dto.status,
          receivedAt: dto.status === "received" ? new Date() : null,
          lines: {
            create: dto.lines.map((line) => ({
              inventoryItemId: line.inventory_item_id,
              quantity: line.quantity,
              unitPrice: line.unit_price
            }))
          }
        },
        include: { lines: true }
      });

      if (dto.status === "received") {
        for (const line of dto.lines) {
          const item = await tx.inventoryItem.findFirst({
            where: {
              id: line.inventory_item_id,
              tenantId: ctx.tenant_id,
              conceptId: ctx.concept_id,
              OR: [{ branchId: ctx.branch_id }, { branchId: null }]
            }
          });
          if (!item) throw new NotFoundException(`Inventory item not found: ${line.inventory_item_id}`);
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { stockLevel: { increment: line.quantity } }
          });
          await tx.stockLedger.create({
            data: {
              inventoryItemId: item.id,
              branchId: ctx.branch_id,
              txnType: "addition",
              qty: line.quantity,
              reference: `po:${po.poNumber}`
            }
          });
          if (line.lot_number && line.expiry_date) {
            await tx.lotTracking.upsert({
              where: {
                inventoryItemId_lotNumber_branchId: {
                  inventoryItemId: item.id,
                  lotNumber: line.lot_number,
                  branchId: ctx.branch_id
                }
              },
              create: {
                inventoryItemId: item.id,
                lotNumber: line.lot_number,
                expiryDate: new Date(line.expiry_date),
                quantity: line.quantity,
                branchId: ctx.branch_id
              },
              update: {
                quantity: { increment: line.quantity },
                expiryDate: new Date(line.expiry_date)
              }
            });
          }
        }
        await this.posting.post(ctx, { type: "PURCHASE_RECEIVED", purchase_order_id: po.id }, tx);
      }

      return po;
    });
  }

  async getPurchaseOrder(ctx: TenantContext, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId: ctx.tenant_id, branchId: ctx.branch_id },
      include: { lines: true, supplier: true }
    });
    if (!po) throw new NotFoundException("Purchase order not found");
    return po;
  }

  async transferStock(ctx: TenantContext, dto: StockTransferDto) {
    const from = await this.prisma.inventoryItem.findFirst({
      where: {
        id: dto.inventory_item_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!from) throw new NotFoundException("Source stock item not found");
    if (Number(from.stockLevel) < dto.quantity) throw new BadRequestException("Insufficient source stock");

    const to = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: dto.to_branch_id,
        sku: from.sku
      }
    });
    if (!to) throw new NotFoundException("Destination stock item not found by SKU");

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          fromBranchId: ctx.branch_id,
          toBranchId: dto.to_branch_id,
          inventoryItemId: from.id,
          quantity: dto.quantity,
          status: dto.status
        }
      });
      if (dto.status === "completed") {
        await tx.inventoryItem.update({
          where: { id: from.id },
          data: { stockLevel: { decrement: dto.quantity } }
        });
        await tx.inventoryItem.update({
          where: { id: to.id },
          data: { stockLevel: { increment: dto.quantity } }
        });
        await tx.stockLedger.createMany({
          data: [
            {
              inventoryItemId: from.id,
              branchId: ctx.branch_id,
              txnType: "deduction",
              qty: -dto.quantity,
              reference: `transfer_out:${transfer.id}`
            },
            {
              inventoryItemId: to.id,
              branchId: dto.to_branch_id,
              txnType: "addition",
              qty: dto.quantity,
              reference: `transfer_in:${transfer.id}`
            }
          ]
        });
        await this.posting.post(ctx, { type: "STOCK_TRANSFER", transfer_id: transfer.id }, tx);
      }
      return transfer;
    });
  }

  async createWastage(ctx: TenantContext, dto: WastageDto) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id: dto.inventory_item_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    if (Number(item.stockLevel) < dto.quantity) throw new BadRequestException("Insufficient stock");

    return this.prisma.$transaction(async (tx) => {
      const wastage = await tx.wastageEntry.create({
        data: {
          branchId: ctx.branch_id,
          inventoryItemId: item.id,
          quantity: dto.quantity,
          reason: dto.reason,
          createdBy: dto.created_by
        }
      });
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { stockLevel: { decrement: dto.quantity } }
      });
      await tx.stockLedger.create({
        data: {
          inventoryItemId: item.id,
          branchId: ctx.branch_id,
          txnType: "deduction",
          qty: -dto.quantity,
          reference: `wastage:${wastage.id}`
        }
      });
      await this.consumeLotsFefo(
        item.id,
        ctx.branch_id,
        dto.quantity,
        `wastage:${wastage.id}`,
        tx
      );
      await this.posting.post(ctx, { type: "WASTAGE", wastage_id: wastage.id }, tx);
      return wastage;
    });
  }

  async createProductionBuild(ctx: TenantContext, dto: ProductionBuildDto) {
    if (!dto.ingredient_lines?.length) {
      throw new BadRequestException("ingredient_lines are required for production build");
    }
    return this.prisma.$transaction(async (tx) => {
      const finished = await tx.inventoryItem.findFirst({
        where: {
          id: dto.finished_inventory_item_id,
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          OR: [{ branchId: ctx.branch_id }, { branchId: null }]
        }
      });
      if (!finished) throw new NotFoundException("Finished inventory item not found");

      const buildRef = `build:${randomUUID()}`;
      let totalInputCost = 0;
      for (const line of dto.ingredient_lines) {
        const item = await tx.inventoryItem.findFirst({
          where: {
            id: line.inventory_item_id,
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            OR: [{ branchId: ctx.branch_id }, { branchId: null }]
          }
        });
        if (!item) throw new NotFoundException(`Ingredient not found: ${line.inventory_item_id}`);
        if (Number(item.stockLevel) < Number(line.quantity)) {
          throw new BadRequestException(`Insufficient ingredient stock: ${item.name}`);
        }
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { stockLevel: { decrement: line.quantity } }
        });
        await tx.stockLedger.create({
          data: {
            inventoryItemId: item.id,
            branchId: ctx.branch_id,
            txnType: "deduction",
            qty: -Number(line.quantity),
            reference: `production_consume:${buildRef}`
          }
        });
        await this.consumeLotsFefo(
          item.id,
          ctx.branch_id,
          Number(line.quantity),
          `production_consume:${buildRef}`,
          tx
        );
        const unitCost = await this.resolveAverageUnitCost(
          ctx.tenant_id,
          ctx.branch_id,
          item.id,
          tx
        );
        totalInputCost += unitCost * Number(line.quantity);
      }

      const yieldPct = dto.yield_pct ?? 100;
      const wastePct = dto.waste_pct ?? 0;
      const producedQty =
        Number(dto.build_qty) *
        (Math.max(0, yieldPct) / 100) *
        (1 - Math.max(0, wastePct) / 100);

      await tx.inventoryItem.update({
        where: { id: finished.id },
        data: { stockLevel: { increment: producedQty } }
      });
      await tx.stockLedger.create({
        data: {
          inventoryItemId: finished.id,
          branchId: ctx.branch_id,
          txnType: "addition",
          qty: producedQty,
          reference: `production_output:${buildRef}`
        }
      });

      await this.posting.post(
        ctx,
        {
          type: "PRODUCTION",
          batch_id: buildRef,
          valuation_amount: Number(totalInputCost.toFixed(2))
        },
        tx
      );
      return {
        production_batch_id: buildRef,
        finished_inventory_item_id: finished.id,
        produced_qty: Number(producedQty.toFixed(6)),
        valuation_amount: Number(totalInputCost.toFixed(2))
      };
    });
  }

  async getLotTracking(ctx: TenantContext) {
    const rows = await this.prisma.lotTracking.findMany({
      where: {
        branchId: ctx.branch_id,
        inventoryItem: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id
        }
      },
      include: { inventoryItem: true },
      orderBy: { expiryDate: "asc" }
    });
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return rows.map((row) => ({
      id: row.id,
      inventory_item_id: row.inventoryItemId,
      item_name: row.inventoryItem.name,
      lot_number: row.lotNumber,
      expiry_date: row.expiryDate,
      quantity: Number(row.quantity),
      expiring_soon: row.expiryDate.getTime() - now <= thirtyDaysMs
    }));
  }

  private async consumeLotsFefo(
    inventoryItemId: string,
    branchId: string,
    qty: number,
    reference: string,
    db: Prisma.TransactionClient | PrismaService
  ) {
    if (qty <= 0) return;
    const lots = await db.lotTracking.findMany({
      where: { inventoryItemId, branchId, quantity: { gt: 0 } },
      orderBy: { expiryDate: "asc" }
    });
    if (!lots.length) return;
    let remaining = qty;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const available = Number(lot.quantity);
      const take = Math.min(remaining, available);
      if (take <= 0) continue;
      await db.lotTracking.update({
        where: { id: lot.id },
        data: { quantity: { decrement: take } }
      });
      await db.stockLedger.create({
        data: {
          inventoryItemId,
          branchId,
          txnType: "deduction",
          qty: -take,
          reference: `lot:${lot.lotNumber}:${reference}`
        }
      });
      remaining -= take;
    }
    if (remaining > 0.000001) {
      throw new BadRequestException("Insufficient lot quantity for FEFO-tracked stock");
    }
  }
}
