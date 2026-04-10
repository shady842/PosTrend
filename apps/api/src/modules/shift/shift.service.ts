import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { CashDrawerMoveDto, CloseShiftDto, OpenShiftDto, PerformDayCloseDto } from "./dto/shift.dto";

@Injectable()
export class ShiftService {
  constructor(private readonly prisma: PrismaService) {}

  async currentShift(ctx: TenantContext) {
    const shift = await this.prisma.shift.findFirst({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id, status: "OPEN" },
      orderBy: { startTime: "desc" }
    });
    if (!shift) return null;
    const drawer = await this.prisma.cashDrawer.findFirst({
      where: { shiftId: shift.id, branchId: ctx.branch_id, closedAt: null },
      include: { movements: true }
    });
    if (!drawer) return null;
    let expected = Number(drawer.startingAmount);
    for (const m of drawer.movements) {
      expected += m.type === "in" ? Number(m.amount) : -Number(m.amount);
    }
    return {
      shift_id: shift.id,
      shift_name: shift.name,
      status: shift.status,
      opened_at: shift.startTime,
      cash_drawer_id: drawer.id,
      opened_by: drawer.openedBy,
      starting_amount: Number(drawer.startingAmount),
      expected_amount: Number(expected.toFixed(2))
    };
  }

  async ensureOpenShift(ctx: TenantContext) {
    const openShift = await this.prisma.shift.findFirst({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id, status: "OPEN" }
    });
    if (!openShift) {
      throw new BadRequestException("Shift must be open before POS orders");
    }
    return openShift;
  }

  async openShift(ctx: TenantContext, dto: OpenShiftDto) {
    const existing = await this.prisma.shift.findFirst({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id, status: "OPEN" }
    });
    if (existing) throw new BadRequestException("An open shift already exists for this branch");
    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.create({
        data: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id,
          name: dto.name,
          startTime: new Date(),
          status: "OPEN"
        }
      });
      const drawer = await tx.cashDrawer.create({
        data: {
          branchId: ctx.branch_id,
          shiftId: shift.id,
          openedAt: new Date(),
          openedBy: dto.opened_by,
          startingAmount: dto.starting_amount
        }
      });
      return { shift_id: shift.id, cash_drawer_id: drawer.id, status: "OPEN" };
    });
  }

  async closeShift(ctx: TenantContext, dto: CloseShiftDto) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: dto.shift_id, tenantId: ctx.tenant_id, branchId: ctx.branch_id, status: "OPEN" }
    });
    if (!shift) throw new NotFoundException("Open shift not found");
    const drawer = await this.prisma.cashDrawer.findFirst({
      where: { shiftId: shift.id, branchId: ctx.branch_id, closedAt: null }
    });
    if (!drawer) throw new NotFoundException("Open cash drawer not found");
    const movements = await this.prisma.cashMovement.findMany({
      where: { cashDrawerId: drawer.id }
    });
    let expected = Number(drawer.startingAmount);
    for (const movement of movements) {
      expected += movement.type === "in" ? Number(movement.amount) : -Number(movement.amount);
    }
    const variance = Number((dto.ending_amount - expected).toFixed(2));
    const periodStart = shift.startTime;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.cashDrawer.update({
        where: { id: drawer.id },
        data: { closedAt: new Date(), closedBy: dto.closed_by, endingAmount: dto.ending_amount }
      });
      await tx.shift.update({
        where: { id: shift.id },
        data: { endTime: new Date(), status: "CLOSED" }
      });
      if (Math.abs(variance) > 0.0001) {
        await tx.cashMovement.create({
          data: {
            cashDrawerId: drawer.id,
            type: variance >= 0 ? "in" : "out",
            amount: Math.abs(variance),
            reason: variance >= 0 ? "cash_over_adjustment" : "cash_short_adjustment",
            createdBy: dto.closed_by
          }
        });
      }
      return { shift_id: shift.id, status: "CLOSED", expected_amount: expected, variance };
    });
    const sales_report = await this.posSalesReport(ctx, periodStart, new Date());
    return { ...result, sales_report };
  }

  /** Sales / tax / discounts / payments / item & category breakdown for a time window (POS shift or day-close). */
  async posSalesReport(ctx: TenantContext, from: Date, to: Date) {
    const { tenant_id: tenantId, concept_id: conceptId, branch_id: branchId } = ctx;
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        conceptId,
        branchId,
        createdAt: { gte: from, lte: to },
        status: { not: "VOIDED" }
      },
      include: {
        payments: true,
        discounts: true,
        items: {
          where: { status: { not: "VOIDED" } },
          include: { menuItem: { include: { category: true } } }
        }
      }
    });

    let subtotalSum = 0;
    let taxSum = 0;
    let serviceSum = 0;
    let discountSum = 0;
    const byType: Record<string, { count: number; total: number }> = {};
    for (const o of orders) {
      subtotalSum += Number(o.subtotal);
      taxSum += Number(o.tax);
      serviceSum += Number(o.service);
      for (const d of o.discounts) {
        if (d.type === "percent") {
          discountSum += (Number(o.subtotal) * Number(d.value)) / 100;
        } else {
          discountSum += Number(d.value);
        }
      }
      const t = o.orderType || "UNKNOWN";
      if (!byType[t]) byType[t] = { count: 0, total: 0 };
      byType[t].count += 1;
      byType[t].total += Number(o.total);
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        conceptId,
        branchId,
        status: "paid",
        paidAt: { gte: from, lte: to }
      }
    });
    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      const m = p.paymentMethod || "unknown";
      byMethod[m] = Number((byMethod[m] || 0) + Number(p.amount));
    }

    const itemAgg = new Map<string, { qty: number; amount: number }>();
    const catAgg = new Map<string, { qty: number; amount: number }>();
    for (const o of orders) {
      for (const it of o.items) {
        const name = (it.nameSnapshot || it.menuItem?.name || "Item").trim();
        const cat = it.menuItem?.category?.name || "Uncategorized";
        const qty = Number(it.qty);
        const amt = Number(it.lineTotal);
        const cur = itemAgg.get(name) || { qty: 0, amount: 0 };
        cur.qty += qty;
        cur.amount += amt;
        itemAgg.set(name, cur);
        const ccur = catAgg.get(cat) || { qty: 0, amount: 0 };
        ccur.qty += qty;
        ccur.amount += amt;
        catAgg.set(cat, ccur);
      }
    }

    const salesTotal = orders.reduce((s, o) => s + Number(o.total), 0);
    const paymentsTotal = payments.reduce((s, p) => s + Number(p.amount), 0);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      orders_count: orders.length,
      subtotal: Number(subtotalSum.toFixed(2)),
      tax: Number(taxSum.toFixed(2)),
      service: Number(serviceSum.toFixed(2)),
      discounts: Number(discountSum.toFixed(2)),
      sales_total: Number(salesTotal.toFixed(2)),
      by_order_type: byType,
      payments_by_method: Object.fromEntries(
        Object.entries(byMethod).map(([k, v]) => [k, Number(v.toFixed(2))])
      ),
      payments_total: Number(paymentsTotal.toFixed(2)),
      items: [...itemAgg.entries()]
        .map(([name, v]) => ({
          name,
          qty: Number(v.qty.toFixed(3)),
          amount: Number(v.amount.toFixed(2))
        }))
        .sort((a, b) => b.amount - a.amount),
      categories: [...catAgg.entries()]
        .map(([name, v]) => ({
          name,
          qty: Number(v.qty.toFixed(3)),
          amount: Number(v.amount.toFixed(2))
        }))
        .sort((a, b) => b.amount - a.amount)
    };
  }

  async moveCash(ctx: TenantContext, dto: CashDrawerMoveDto) {
    const drawer = await this.prisma.cashDrawer.findFirst({
      where: { id: dto.cash_drawer_id, branchId: ctx.branch_id, closedAt: null },
      include: { shift: true }
    });
    if (!drawer) throw new NotFoundException("Open cash drawer not found");
    if (drawer.shift.status !== "OPEN") throw new BadRequestException("Shift is not open");
    const movement = await this.prisma.cashMovement.create({
      data: {
        cashDrawerId: drawer.id,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason,
        createdBy: dto.created_by
      }
    });
    return { id: movement.id, status: "recorded" };
  }

  async performDayClose(ctx: TenantContext, dto: PerformDayCloseDto) {
    const openShift = await this.prisma.shift.count({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id, status: "OPEN" }
    });
    if (openShift > 0) {
      throw new BadRequestException("All shifts must be closed before day close");
    }
    const date = dto.date ? new Date(dto.date) : new Date();
    const orders = await this.prisma.order.findMany({
      where: { branchId: ctx.branch_id, status: { in: ["CLOSED", "closed"] } }
    });
    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const paymentRows = await this.prisma.payment.findMany({
      where: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        status: { in: ["paid", "refunded"] }
      }
    });
    const paymentSummary: Record<string, number> = {};
    for (const p of paymentRows) {
      const method = p.paymentMethod || "unknown";
      paymentSummary[method] = Number((paymentSummary[method] || 0) + Number(p.amount));
    }
    const drawers = await this.prisma.cashDrawer.findMany({
      where: { branchId: ctx.branch_id, closedAt: { not: null } },
      include: { movements: true }
    });
    let cashCounted = 0;
    let cashExpected = 0;
    let cashVariance = 0;
    for (const drawer of drawers) {
      let expected = Number(drawer.startingAmount);
      for (const m of drawer.movements) {
        expected += m.type === "in" ? Number(m.amount) : -Number(m.amount);
      }
      const counted = Number(drawer.endingAmount || 0);
      cashExpected += expected;
      cashCounted += counted;
      cashVariance += Number((counted - expected).toFixed(2));
    }
    const closure = await this.prisma.dayClosure.create({
      data: {
        branchId: ctx.branch_id,
        date,
        totalSales,
        cashVariance,
        closedBy: dto.closed_by
      }
    });
    const paymentTotal = Object.values(paymentSummary).reduce((s, v) => s + Number(v), 0);
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const comprehensive_report = await this.posSalesReport(ctx, dayStart, new Date());
    return {
      closure,
      summary: {
        sales_summary: {
          closed_orders: orders.length,
          total_sales: Number(totalSales.toFixed(2))
        },
        payment_summary: {
          by_method: Object.fromEntries(
            Object.entries(paymentSummary).map(([k, v]) => [k, Number(v.toFixed(2))])
          ),
          total_payments: Number(paymentTotal.toFixed(2))
        },
        cash_summary: {
          drawers_closed: drawers.length,
          expected_cash: Number(cashExpected.toFixed(2)),
          counted_cash: Number(cashCounted.toFixed(2)),
          variance: Number(cashVariance.toFixed(2))
        }
      },
      comprehensive_report
    };
  }

  async dayCloseSummary(ctx: TenantContext) {
    const orders = await this.prisma.order.findMany({
      where: { branchId: ctx.branch_id, status: { in: ["CLOSED", "closed"] } }
    });
    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);

    const paymentRows = await this.prisma.payment.findMany({
      where: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        status: { in: ["paid", "refunded"] }
      }
    });
    const paymentSummary: Record<string, number> = {};
    for (const p of paymentRows) {
      const method = p.paymentMethod || "unknown";
      paymentSummary[method] = Number((paymentSummary[method] || 0) + Number(p.amount));
    }
    const paymentTotal = Object.values(paymentSummary).reduce((s, v) => s + Number(v), 0);

    const drawers = await this.prisma.cashDrawer.findMany({
      where: { branchId: ctx.branch_id, closedAt: { not: null } },
      include: { movements: true }
    });
    let cashCounted = 0;
    let cashExpected = 0;
    let cashVariance = 0;
    for (const drawer of drawers) {
      let expected = Number(drawer.startingAmount);
      for (const m of drawer.movements) {
        expected += m.type === "in" ? Number(m.amount) : -Number(m.amount);
      }
      const counted = Number(drawer.endingAmount || 0);
      cashExpected += expected;
      cashCounted += counted;
      cashVariance += Number((counted - expected).toFixed(2));
    }

    return {
      sales_summary: {
        closed_orders: orders.length,
        total_sales: Number(totalSales.toFixed(2))
      },
      payment_summary: {
        by_method: Object.fromEntries(
          Object.entries(paymentSummary).map(([k, v]) => [k, Number(v.toFixed(2))])
        ),
        total_payments: Number(paymentTotal.toFixed(2))
      },
      cash_summary: {
        drawers_closed: drawers.length,
        expected_cash: Number(cashExpected.toFixed(2)),
        counted_cash: Number(cashCounted.toFixed(2)),
        variance: Number(cashVariance.toFixed(2))
      }
    };
  }

  dayCloseReports(ctx: TenantContext) {
    return this.prisma.dayClosure.findMany({
      where: { branchId: ctx.branch_id },
      orderBy: { closedAt: "desc" }
    });
  }
}
