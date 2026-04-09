import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { ReportFilterDto } from "./dto/reports.dto";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async sales(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "sales", q);
    const where = this.orderWhere(ctx, q);
    const orders = await this.prisma.order.findMany({ where, orderBy: { createdAt: "desc" } });
    const rows = orders.map((o) => ({
      date: o.createdAt.toISOString().slice(0, 10),
      branch_id: o.branchId,
      concept_id: o.conceptId,
      gross_sales: Number(o.subtotal) + Number(o.tax) + Number(o.service),
      net_sales: Number(o.total),
      orders: 1
    }));
    return this.paginatedOrExport(rows, q, "reports_sales");
  }

  async items(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "items", q);
    const where = this.orderWhere(ctx, q);
    const items = await this.prisma.orderItem.findMany({
      where: { order: where },
      include: { menuItem: true }
    });
    const mapped = new Map<string, { item_id: string; item_name: string; qty: number; revenue: number }>();
    for (const it of items) {
      const key = it.menuItemId;
      const cur = mapped.get(key) || { item_id: key, item_name: it.menuItem.name, qty: 0, revenue: 0 };
      cur.qty += Number(it.qty);
      cur.revenue += Number(it.lineTotal);
      mapped.set(key, cur);
    }
    const rows = [...mapped.values()].sort((a, b) => b.revenue - a.revenue);
    return this.paginatedOrExport(rows, q, "reports_items");
  }

  async cashier(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "cashier", q);
    const where = this.orderWhere(ctx, q);
    const orders = await this.prisma.order.findMany({ where });
    const mapped = new Map<string, { user_id: string; orders: number; sales: number }>();
    for (const o of orders) {
      const uid = o.openedBy || "unknown";
      if (q.user_id && q.user_id !== uid) continue;
      const cur = mapped.get(uid) || { user_id: uid, orders: 0, sales: 0 };
      cur.orders += 1;
      cur.sales += Number(o.total);
      mapped.set(uid, cur);
    }
    return this.paginatedOrExport([...mapped.values()], q, "reports_cashier");
  }

  async shifts(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "shifts", q);
    const shifts = await this.prisma.shift.findMany({
      where: {
        tenantId: ctx.tenant_id,
        branchId: this.enforceScope(q.branch_id, ctx.branch_id, "branch_id"),
        startTime: this.dateRange(q.date_from, q.date_to)
      },
      orderBy: { startTime: "desc" }
    });
    const rows = shifts.map((s) => ({
      shift_id: s.id,
      name: s.name,
      status: s.status,
      start_time: s.startTime,
      end_time: s.endTime
    }));
    return this.paginatedOrExport(rows, q, "reports_shifts");
  }

  async dayClose(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "day_close", q);
    const rows = await this.prisma.dayClosure.findMany({
      where: {
        branchId: this.enforceScope(q.branch_id, ctx.branch_id, "branch_id"),
        date: this.dateRange(q.date_from, q.date_to)
      },
      orderBy: { closedAt: "desc" }
    });
    return this.paginatedOrExport(rows, q, "reports_day_close");
  }

  async inventory(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "inventory", q);
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: this.enforceScope(q.concept_id, ctx.concept_id, "concept_id"),
        OR: [
          { branchId: this.enforceScope(q.branch_id, ctx.branch_id, "branch_id") },
          { branchId: null }
        ]
      },
      orderBy: { stockLevel: "asc" }
    });
    const mapped = rows.map((r) => ({
      inventory_item_id: r.id,
      name: r.name,
      stock_level: Number(r.stockLevel),
      reorder_point: Number(r.reorderPoint),
      low_stock: Number(r.stockLevel) <= Number(r.reorderPoint)
    }));
    return this.paginatedOrExport(mapped, q, "reports_inventory");
  }

  /** Live operational snapshot for tenant dashboard (no audit — polled frequently). */
  async liveOps(ctx: TenantContext, branchIdParam?: string) {
    const branchId = branchIdParam
      ? this.enforceScope(branchIdParam, ctx.branch_id, "branch_id")
      : ctx.branch_id;

    const activeStatuses = [
      "OPEN",
      "draft",
      "SENT_TO_KITCHEN",
      "PREPARING",
      "READY",
      "SERVED",
      "BILLED"
    ];

    const [active_orders, kds_tickets, occupied_tables] = await Promise.all([
      this.prisma.order.count({
        where: {
          tenantId: ctx.tenant_id,
          branchId,
          status: { in: activeStatuses }
        }
      }),
      this.prisma.kdsTicket.count({
        where: {
          status: { in: ["pending", "preparing", "ready"] },
          station: { tenantId: ctx.tenant_id, branchId }
        }
      }),
      this.prisma.tableSession.count({
        where: {
          tenantId: ctx.tenant_id,
          branchId,
          status: "OPEN",
          closedAt: null
        }
      })
    ]);

    return {
      branch_id: branchId,
      active_orders,
      kds_tickets,
      occupied_tables,
      server_time: new Date().toISOString()
    };
  }

  async discountsRefunds(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "discounts_refunds", q);
    const where = this.orderWhere(ctx, q);
    const discounts = await this.prisma.orderDiscount.findMany({ where: { order: where } });
    const refunds = await this.prisma.refund.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: this.enforceScope(q.concept_id, ctx.concept_id, "concept_id"),
        branchId: this.enforceScope(q.branch_id, ctx.branch_id, "branch_id"),
        createdAt: this.dateRange(q.date_from, q.date_to)
      }
    });
    const discountTotal = discounts.reduce((s, d) => s + Number(d.value), 0);
    const refundTotal = refunds.reduce((s, r) => s + Number(r.amount), 0);
    const rows = [{ discount_total: discountTotal, refund_total: refundTotal }];
    return this.paginatedOrExport(rows, q, "reports_discounts_refunds");
  }

  private orderWhere(ctx: TenantContext, q: ReportFilterDto) {
    return {
      tenantId: ctx.tenant_id,
      conceptId: this.enforceScope(q.concept_id, ctx.concept_id, "concept_id"),
      branchId: this.enforceScope(q.branch_id, ctx.branch_id, "branch_id"),
      createdAt: this.dateRange(q.date_from, q.date_to),
      status: { notIn: ["VOIDED", "voided"] }
    };
  }

  private dateRange(dateFrom?: string, dateTo?: string) {
    if (!dateFrom && !dateTo) return undefined;
    const range: { gte?: Date; lte?: Date } = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) range.lte = new Date(dateTo);
    return range;
  }

  private enforceScope(requested: string | undefined, scoped: string, key: string) {
    if (!requested) return scoped;
    if (requested !== scoped) throw new BadRequestException(`${key} out of scope`);
    return requested;
  }

  private parsePagination(q: ReportFilterDto) {
    const page = Math.max(1, Number(q.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(q.page_size || 20)));
    return { page, pageSize };
  }

  private paginatedOrExport<T extends Record<string, unknown>>(rows: T[], q: ReportFilterDto, label: string) {
    if (q.export) {
      const csv = this.toCsv(rows);
      return {
        export_format: q.export,
        file_name: `${label}.${q.export}`,
        content_base64: Buffer.from(csv, "utf8").toString("base64")
      };
    }
    const { page, pageSize } = this.parsePagination(q);
    const start = (page - 1) * pageSize;
    return {
      page,
      page_size: pageSize,
      total: rows.length,
      data: rows.slice(start, start + pageSize)
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

  private audit(ctx: TenantContext, reportType: string, q: ReportFilterDto) {
    return this.prisma.reportAuditLog.create({
      data: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id,
        actorId: ctx.sub,
        reportType,
        filters: q as unknown as Prisma.InputJsonValue
      }
    });
  }
}
