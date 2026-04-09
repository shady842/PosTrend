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
    return this.prisma.$transaction(async (tx) => {
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
      where: { branchId: ctx.branch_id, status: "closed" }
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
      }
    };
  }

  async dayCloseSummary(ctx: TenantContext) {
    const orders = await this.prisma.order.findMany({
      where: { branchId: ctx.branch_id, status: "closed" }
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
