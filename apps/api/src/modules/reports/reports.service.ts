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
    const branchId = await this.resolveBranchScope(ctx, q.branch_id);
    const where = {
      tenantId: ctx.tenant_id,
      conceptId: this.enforceScope(q.concept_id, ctx.concept_id, "concept_id"),
      branchId,
      createdAt: this.dateRange(q.date_from, q.date_to),
      status: { notIn: ["VOIDED", "voided"] }
    };
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

  async hourlySales(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "hourly_sales", q);
    const branchId = await this.resolveBranchScope(ctx, q.branch_id);
    const conceptId = this.enforceScope(q.concept_id, ctx.concept_id, "concept_id");
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        createdAt: this.dateRange(q.date_from, q.date_to),
        status: { notIn: ["VOIDED", "voided"] }
      },
      select: { createdAt: true, total: true }
    });
    const buckets = new Map<string, { hour: string; invoices: number; sales: number }>();
    for (let i = 0; i < 24; i++) {
      const h = `${String(i).padStart(2, "0")}:00`;
      buckets.set(h, { hour: h, invoices: 0, sales: 0 });
    }
    for (const o of orders) {
      const h = `${String(o.createdAt.getHours()).padStart(2, "0")}:00`;
      const cur = buckets.get(h);
      if (!cur) continue;
      cur.invoices += 1;
      cur.sales += Number(o.total || 0);
    }
    return this.paginatedOrExport([...buckets.values()], q, "reports_hourly_sales");
  }

  async invoiceSales(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "invoice_sales", q);
    const branchId = await this.resolveBranchScope(ctx, q.branch_id);
    const conceptId = this.enforceScope(q.concept_id, ctx.concept_id, "concept_id");
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        createdAt: this.dateRange(q.date_from, q.date_to),
        status: { notIn: ["VOIDED", "voided"] }
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        orderType: true,
        status: true,
        total: true
      }
    });
    const rows = orders.map((o) => ({
      invoice_id: o.id,
      invoice_no: o.orderNumber || o.id.slice(0, 8),
      opened_at: o.createdAt,
      order_type: o.orderType,
      status: o.status,
      total: Number(o.total)
    }));
    return this.paginatedOrExport(rows, q, "reports_invoice_sales");
  }

  async items(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "items", q);
    const branchId = await this.resolveBranchScope(ctx, q.branch_id);
    const where = {
      tenantId: ctx.tenant_id,
      conceptId: this.enforceScope(q.concept_id, ctx.concept_id, "concept_id"),
      branchId,
      createdAt: this.dateRange(q.date_from, q.date_to),
      status: { notIn: ["VOIDED", "voided"] }
    };
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

  async paymentMethods(ctx: TenantContext, q: ReportFilterDto) {
    await this.audit(ctx, "payment_methods", q);
    const branchId = await this.resolveBranchScope(ctx, q.branch_id);
    const conceptId = this.enforceScope(q.concept_id, ctx.concept_id, "concept_id");
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId,
        branchId,
        createdAt: this.dateRange(q.date_from, q.date_to),
        status: { notIn: ["voided", "VOIDED", "failed", "FAILED"] }
      },
      select: { paymentMethod: true, amount: true }
    });
    const mapped = new Map<string, { method: string; count: number; amount: number }>();
    for (const p of payments) {
      const key = String(p.paymentMethod || "unknown").toLowerCase();
      const cur = mapped.get(key) || { method: key, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(p.amount || 0);
      mapped.set(key, cur);
    }
    const rows = [...mapped.values()].sort((a, b) => b.amount - a.amount);
    return this.paginatedOrExport(rows, q, "reports_payment_methods");
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
    const branchId = await this.resolveBranchScope(ctx, branchIdParam);

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

  private async resolveBranchScope(ctx: TenantContext, requested?: string) {
    if (!requested || requested.length === 0) return ctx.branch_id;
    if (requested === ctx.branch_id) return requested;
    if (!["tenant_owner", "admin", "super_admin"].includes(ctx.role)) {
      throw new BadRequestException("branch_id out of scope");
    }
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: requested,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id
      },
      select: { id: true }
    });
    if (!branch) throw new BadRequestException("branch_id out of scope");
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
