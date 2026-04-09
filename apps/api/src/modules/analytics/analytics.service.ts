import { BadRequestException, Injectable } from "@nestjs/common";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import { AnalyticsFilterDto } from "./dto/analytics.dto";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async sales(ctx: TenantContext, q: AnalyticsFilterDto) {
    const where = this.orderWhere(ctx, q);
    const orders = await this.prisma.order.findMany({ where });
    const grouped = new Map<string, { date: string; gross: number; net: number; orders: number }>();
    for (const o of orders) {
      const d = o.createdAt.toISOString().slice(0, 10);
      const cur = grouped.get(d) || { date: d, gross: 0, net: 0, orders: 0 };
      cur.gross += Number(o.subtotal) + Number(o.tax) + Number(o.service);
      cur.net += Number(o.total);
      cur.orders += 1;
      grouped.set(d, cur);
    }
    const rows = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
    return this.wrap(rows, q, "analytics_sales");
  }

  async items(ctx: TenantContext, q: AnalyticsFilterDto) {
    const items = await this.prisma.orderItem.findMany({
      where: { order: this.orderWhere(ctx, q) },
      include: { menuItem: true }
    });
    const byItem = new Map<string, { item_id: string; item_name: string; qty: number; revenue: number; profitability: number }>();
    for (const it of items) {
      const key = it.menuItemId;
      const cur = byItem.get(key) || { item_id: key, item_name: it.menuItem.name, qty: 0, revenue: 0, profitability: 0 };
      cur.qty += Number(it.qty);
      cur.revenue += Number(it.lineTotal);
      cur.profitability = Number((cur.revenue * 0.65).toFixed(2));
      byItem.set(key, cur);
    }
    return this.wrap([...byItem.values()].sort((a, b) => b.revenue - a.revenue), q, "analytics_items");
  }

  async customers(ctx: TenantContext, q: AnalyticsFilterDto) {
    const orders = await this.prisma.order.findMany({
      where: { ...this.orderWhere(ctx, q), customerId: { not: null } }
    });
    const map = new Map<string, { customer_id: string; orders: number; spend: number; avg_basket: number }>();
    for (const o of orders) {
      const id = o.customerId!;
      const cur = map.get(id) || { customer_id: id, orders: 0, spend: 0, avg_basket: 0 };
      cur.orders += 1;
      cur.spend += Number(o.total);
      cur.avg_basket = Number((cur.spend / cur.orders).toFixed(2));
      map.set(id, cur);
    }
    return this.wrap([...map.values()].sort((a, b) => b.spend - a.spend), q, "analytics_customers");
  }

  async inventory(ctx: TenantContext, q: AnalyticsFilterDto) {
    const inventory = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: this.scope(q.concept_id, ctx.concept_id, "concept_id"),
        OR: [{ branchId: this.scope(q.branch_id, ctx.branch_id, "branch_id") }, { branchId: null }]
      }
    });
    const rows = inventory.map((i) => ({
      inventory_item_id: i.id,
      name: i.name,
      stock_level: Number(i.stockLevel),
      reorder_point: Number(i.reorderPoint),
      low_stock: Number(i.stockLevel) <= Number(i.reorderPoint)
    }));
    return this.wrap(rows, q, "analytics_inventory");
  }

  async purchase(ctx: TenantContext, q: AnalyticsFilterDto) {
    const branchId = this.scope(q.branch_id, ctx.branch_id, "branch_id");
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { tenantId: ctx.tenant_id, branchId, createdAt: this.range(q.date_from, q.date_to) },
      include: { lines: true }
    });
    const bills = await this.prisma.apBill.findMany({
      where: { tenantId: ctx.tenant_id, branchId, createdAt: this.range(q.date_from, q.date_to) }
    });
    const purchaseAmount = pos.reduce((s, p) => s + p.lines.reduce((x, l) => x + Number(l.quantity) * Number(l.unitPrice), 0), 0);
    const billAmount = bills.reduce((s, b) => s + Number(b.amount), 0);
    return this.wrap([{ po_count: pos.length, purchase_amount: purchaseAmount, bill_amount: billAmount }], q, "analytics_purchase");
  }

  async profitability(ctx: TenantContext, q: AnalyticsFilterDto) {
    const where = this.orderWhere(ctx, q);
    const orders = await this.prisma.order.findMany({ where });
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const cogsEntries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId: ctx.tenant_id,
        branchId: this.scope(q.branch_id, ctx.branch_id, "branch_id"),
        refType: "order_cogs",
        createdAt: this.range(q.date_from, q.date_to)
      }
    });
    const cogs = cogsEntries.reduce((s, e) => s + Number(e.totalDebit), 0);
    const grossProfit = revenue - cogs;
    const grossMarginPct = revenue > 0 ? Number((grossProfit / revenue).toFixed(4)) : 0;
    const forecasts = await this.prisma.forecastSales.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: this.scope(q.concept_id, ctx.concept_id, "concept_id"),
        branchId: this.scope(q.branch_id, ctx.branch_id, "branch_id"),
        forecastDate: this.range(q.date_from, q.date_to)
      }
    });
    const forecastTotal = forecasts.reduce((s, f) => s + Number(f.predictedSales), 0);
    const variance = Number((revenue - forecastTotal).toFixed(2));
    return this.wrap(
      [{ revenue, cogs, gross_profit: grossProfit, gross_margin_pct: grossMarginPct, forecast_variance: variance }],
      q,
      "analytics_profitability"
    );
  }

  private orderWhere(ctx: TenantContext, q: AnalyticsFilterDto) {
    return {
      tenantId: ctx.tenant_id,
      conceptId: this.scope(q.concept_id, ctx.concept_id, "concept_id"),
      branchId: this.scope(q.branch_id, ctx.branch_id, "branch_id"),
      openedBy: q.staff_id || undefined,
      createdAt: this.range(q.date_from, q.date_to),
      status: { notIn: ["VOIDED", "voided"] }
    };
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

  private wrap<T extends Record<string, unknown>>(rows: T[], q: AnalyticsFilterDto, label: string) {
    const refreshSeconds = Math.max(5, Number(q.refresh_seconds || 30));
    if (q.export) {
      const csv = this.toCsv(rows);
      return {
        export_format: q.export,
        file_name: `${label}.${q.export}`,
        content_base64: Buffer.from(csv, "utf8").toString("base64"),
        chart_series: rows,
        refresh_seconds: refreshSeconds
      };
    }
    const page = Math.max(1, Number(q.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(q.page_size || 20)));
    const start = (page - 1) * pageSize;
    return {
      page,
      page_size: pageSize,
      total: rows.length,
      data: rows.slice(start, start + pageSize),
      chart_series: rows.slice(0, 100),
      refresh_seconds: refreshSeconds,
      generated_at: new Date().toISOString()
    };
  }

  private toCsv(rows: Record<string, unknown>[]) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","));
    }
    return lines.join("\n");
  }
}
