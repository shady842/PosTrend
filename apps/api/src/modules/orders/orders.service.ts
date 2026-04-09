import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { KdsService } from "../kds/kds.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { ShiftService } from "../shift/shift.service";
import { AddOrderItemDto, CreateOrderDto } from "./dto/orders.dto";
import {
  AddItemPosDto,
  AddModifierDto,
  AddOrderNoteDto,
  ApplyDiscountDto,
  ApplyPromotionDto,
  CreateDiningTableDto,
  CreateSectionDto,
  MonitorMoveDto,
  RemoveItemDto,
  SplitOrderDto,
  TransferTableDto,
  UpdateDiningTableDto,
  UpdateSectionDto,
  UpdateQtyDto,
  VoidItemDto,
  VoidOrderDto
} from "./dto/pos-orders.dto";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly kdsService: KdsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly shiftService: ShiftService
  ) {}

  private sumPaidOrder(payments: { status: string; amount: unknown }[]) {
    return payments
      .filter((p) => p.status === "paid" || p.status === "refunded")
      .reduce((s, p) => s + Number(p.amount), 0);
  }

  deriveMonitorColumn(order: { status: string; total: unknown; payments: { status: string; amount: unknown }[] }) {
    const s = String(order.status);
    const su = s.toUpperCase();
    if (su === "VOIDED" || su === "CLOSED" || s === "closed") return "closed" as const;
    const paid = this.sumPaidOrder(order.payments);
    const total = Number(order.total);
    const due = total - paid;
    if ((due <= 0.0001 && total > 0) || su === "BILLED") return "paid" as const;
    if (su === "READY" || su === "SERVED") return "ready" as const;
    if (su === "SENT_TO_KITCHEN" || su === "PREPARING") return "preparing" as const;
    return "open" as const;
  }

  private async resolveMonitorBranchId(ctx: TenantContext, branchIdParam?: string) {
    const id = (branchIdParam?.trim() || ctx.branch_id).trim();
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
    });
    if (!branch) throw new BadRequestException("Invalid branch for this concept");
    return id;
  }

  async liveOrders(ctx: TenantContext, opts?: { branch_id?: string; station_id?: string }) {
    const branchId = await this.resolveMonitorBranchId(ctx, opts?.branch_id);
    const closedSince = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId,
        NOT: { status: "VOIDED" },
        ...(opts?.station_id ? { kdsTickets: { some: { stationId: opts.station_id } } } : {}),
        OR: [
          {
            status: {
              in: ["OPEN", "draft", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED", "BILLED"]
            }
          },
          { status: { in: ["closed", "CLOSED"] }, updatedAt: { gte: closedSince } }
        ]
      },
      include: {
        items: { include: { modifiers: true } },
        payments: true,
        kdsTickets: { include: { station: true } },
        tableSession: true
      },
      orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }]
    });

    const tableIds = [
      ...new Set(
        orders.map((o) => o.tableSession?.tableId).filter((id): id is string => Boolean(id))
      )
    ];
    const tables =
      tableIds.length > 0
        ? await this.prisma.diningTable.findMany({ where: { id: { in: tableIds } } })
        : [];
    const tableMap = Object.fromEntries(tables.map((t) => [t.id, t.name]));

    return orders.map((o) => {
      const start = o.openedAt ?? o.createdAt;
      const secondsOpen = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
      let tableLabel = "—";
      if (o.tableSession?.tableId) {
        tableLabel = tableMap[o.tableSession.tableId] ?? "Table";
      } else if (o.orderType === "TAKEAWAY") {
        tableLabel = "Takeaway";
      } else if (o.orderType === "DELIVERY") {
        tableLabel = "Delivery";
      }
      const stationIds = [...new Set(o.kdsTickets.map((t) => t.stationId))];
      return {
        id: o.id,
        order_number: o.orderNumber,
        order_type: o.orderType,
        status: o.status,
        subtotal: Number(o.subtotal),
        tax: Number(o.tax),
        service: Number(o.service),
        total: Number(o.total),
        opened_at: o.openedAt?.toISOString() ?? null,
        created_at: o.createdAt.toISOString(),
        seconds_open: secondsOpen,
        table_label: tableLabel,
        monitor_column: this.deriveMonitorColumn(o),
        station_ids: stationIds,
        items: o.items
          .filter((it) => it.status !== "VOIDED")
          .map((it) => ({
            id: it.id,
            name: it.nameSnapshot || "Item",
            qty: Number(it.qty),
            line_total: Number(it.lineTotal),
            kitchen_status: it.kitchenStatus
          }))
      };
    });
  }

  async setMonitorColumn(ctx: TenantContext, dto: MonitorMoveDto) {
    const order = await this.getForConceptOrder(dto.order_id, ctx);
    const su = String(order.status).toUpperCase();
    if (su === "VOIDED") throw new BadRequestException("Voided order cannot be moved");
    if (su === "CLOSED" || order.status === "closed") {
      throw new BadRequestException("Closed orders cannot be moved");
    }

    if (dto.column === "closed") {
      await this.close(dto.order_id, ctx);
      return this.getForConceptOrder(dto.order_id, ctx);
    }

    const paid = this.sumPaidOrder(order.payments);
    const total = Number(order.total);
    const due = total - paid;

    switch (dto.column) {
      case "open":
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: "OPEN" }
        });
        await this.prisma.orderItem.updateMany({
          where: { orderId: order.id, status: { not: "VOIDED" } },
          data: { kitchenStatus: "OPEN", status: "OPEN" }
        });
        break;
      case "preparing":
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: "PREPARING" }
        });
        await this.prisma.orderItem.updateMany({
          where: { orderId: order.id, status: { not: "VOIDED" } },
          data: { kitchenStatus: "PREPARING", status: "PREPARING" }
        });
        break;
      case "ready":
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: "READY" }
        });
        await this.prisma.orderItem.updateMany({
          where: { orderId: order.id, status: { not: "VOIDED" } },
          data: { kitchenStatus: "READY", status: "READY" }
        });
        break;
      case "paid":
        if (due > 0.0001) {
          throw new BadRequestException("Order must be fully paid before moving to Paid");
        }
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: "BILLED" }
        });
        break;
      default:
        break;
    }

    this.realtimeGateway.emitPosOrderUpdate(order.branchId, order.id);
    return this.getForConceptOrder(dto.order_id, ctx);
  }

  async openOrder(
    ctx: TenantContext,
    orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY",
    payload: {
      table_id?: string;
      guest_count?: number;
      notes?: string;
      client_order_id?: string;
      customer_id?: string;
    }
  ) {
    await this.shiftService.ensureOpenShift(ctx);
    const orderNumber = await this.nextOrderNumber(ctx.branch_id);
    let tableSessionId: string | null = null;
    if (orderType === "DINE_IN" && payload.table_id) {
      const session = await this.prisma.tableSession.create({
        data: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id,
          tableId: payload.table_id,
          openedAt: new Date(),
          status: "OPEN"
        }
      });
      tableSessionId = session.id;
    }

    return this.prisma.order.create({
      data: {
        id: payload.client_order_id || undefined,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id,
        tableSessionId,
        orderType,
        orderNumber,
        guestCount: payload.guest_count ?? 1,
        notes: payload.notes,
        customerId: payload.customer_id,
        openedBy: ctx.sub,
        openedAt: new Date(),
        channel: orderType.toLowerCase(),
        status: "OPEN",
        subtotal: 0,
        tax: 0,
        service: 0,
        total: 0
      }
    });
  }

  create(dto: CreateOrderDto) {
    return this.prisma.order.create({
      data: {
        tenantId: dto.tenant_id,
        conceptId: dto.concept_id,
        branchId: dto.branch_id,
        channel: dto.channel,
        status: "draft",
        subtotal: 0,
        tax: 0,
        service: 0,
        total: 0
      }
    });
  }

  async addItem(orderId: string, dto: AddOrderItemDto) {
    const menuItem = await this.prisma.menuItem.findFirst({
      where: {
        id: dto.item_id,
        tenantId: dto.tenant_id,
        conceptId: dto.concept_id
      }
    });
    const override = await this.prisma.priceList.findUnique({
      where: {
        branchId_menuItemId: {
          branchId: dto.branch_id,
          menuItemId: dto.item_id
        }
      }
    });
    const unitPrice = Number(override?.priceOverride ?? menuItem?.basePrice ?? 0);
    const lineTotal = Number((unitPrice * dto.qty).toFixed(2));

    await this.prisma.orderItem.create({
      data: {
        tenantId: dto.tenant_id,
        conceptId: dto.concept_id,
        branchId: dto.branch_id,
        orderId,
        menuItemId: dto.item_id,
        qty: dto.qty,
        unitPrice,
        lineTotal,
        kitchenStatus: "new"
      }
    });

    await this.recalculateTotals(orderId);
    return this.get(orderId);
  }

  async addPosItem(ctx: TenantContext, dto: AddItemPosDto) {
    const order = await this.getForTenant(dto.order_id, ctx);
    if (order.status === "VOIDED" || order.status === "CLOSED") {
      throw new NotFoundException("Order is not editable");
    }
    const menuItem = await this.prisma.menuItem.findFirst({
      where: { id: dto.menu_item_id, tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
    });
    if (!menuItem) throw new NotFoundException("Menu item not found");
    const variant = dto.variant_id
      ? await this.prisma.itemVariant.findFirst({ where: { id: dto.variant_id, menuItemId: menuItem.id } })
      : null;
    const override = await this.prisma.priceList.findUnique({
      where: { branchId_menuItemId: { branchId: ctx.branch_id, menuItemId: dto.menu_item_id } }
    });
    const availability = (menuItem.availabilityJson as Record<string, any> | null) || {};
    const branchChannel = availability?.pricing?.branch_channel_prices?.[ctx.branch_id] || {};
    const channelPrice =
      order.orderType === "TAKEAWAY"
        ? Number(branchChannel?.takeaway ?? availability?.pricing?.takeaway ?? NaN)
        : order.orderType === "DELIVERY"
          ? Number(branchChannel?.delivery ?? availability?.pricing?.delivery ?? NaN)
          : Number.NaN;
    const hasChannelPrice = Number.isFinite(channelPrice) && channelPrice >= 0;
    const snapPrice = Number(
      variant?.price ?? (hasChannelPrice ? channelPrice : override?.priceOverride ?? menuItem.basePrice)
    );
    await this.prisma.orderItem.create({
      data: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id,
        orderId: dto.order_id,
        menuItemId: dto.menu_item_id,
        variantId: dto.variant_id,
        nameSnapshot: menuItem.name,
        price: snapPrice,
        qty: dto.qty,
        notes: dto.notes,
        status: "OPEN",
        unitPrice: snapPrice,
        lineTotal: Number((snapPrice * dto.qty).toFixed(2)),
        kitchenStatus: "OPEN"
      }
    });
    await this.recalculateTotals(dto.order_id);
    return this.getForTenant(dto.order_id, ctx);
  }

  async updateQty(ctx: TenantContext, dto: UpdateQtyDto) {
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: dto.order_item_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!item) throw new NotFoundException("Order item not found");
    if (dto.qty <= 0) {
      await this.prisma.orderItem.delete({ where: { id: dto.order_item_id } });
      await this.recalculateTotals(item.orderId);
      return this.getForTenant(item.orderId, ctx);
    }
    const unit = Number(item.price ?? item.unitPrice);
    await this.prisma.orderItem.update({
      where: { id: dto.order_item_id },
      data: {
        qty: dto.qty,
        lineTotal: Number((unit * dto.qty).toFixed(2))
      }
    });
    await this.recalculateTotals(item.orderId);
    return this.getForTenant(item.orderId, ctx);
  }

  async removeItem(ctx: TenantContext, dto: RemoveItemDto) {
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: dto.order_item_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!item) throw new NotFoundException("Order item not found");
    await this.prisma.orderItem.delete({ where: { id: dto.order_item_id } });
    await this.recalculateTotals(item.orderId);
    return this.getForTenant(item.orderId, ctx);
  }

  async addModifier(ctx: TenantContext, dto: AddModifierDto) {
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: dto.order_item_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!item) throw new NotFoundException("Order item not found");
    const option = await this.prisma.modifierOption.findUnique({
      where: { id: dto.modifier_option_id }
    });
    if (!option) throw new NotFoundException("Modifier option not found");
    await this.prisma.orderItemModifier.create({
      data: {
        orderItemId: dto.order_item_id,
        modifierOptionId: dto.modifier_option_id,
        nameSnapshot: option.name,
        price: option.price
      }
    });
    const increment = Number(option.price);
    const qty = Number(item.qty);
    await this.prisma.orderItem.update({
      where: { id: item.id },
      data: {
        lineTotal: Number((Number(item.lineTotal) + increment * qty).toFixed(2))
      }
    });
    await this.recalculateTotals(item.orderId);
    return this.getForTenant(item.orderId, ctx);
  }

  async addOrderNote(ctx: TenantContext, dto: AddOrderNoteDto) {
    const order = await this.getForTenant(dto.order_id, ctx);
    await this.prisma.order.update({
      where: { id: order.id },
      data: { notes: dto.note }
    });
    return this.getForTenant(dto.order_id, ctx);
  }

  async applyDiscount(ctx: TenantContext, dto: ApplyDiscountDto) {
    const order = await this.getForTenant(dto.order_id, ctx);
    await this.prisma.orderDiscount.create({
      data: {
        orderId: dto.order_id,
        type: dto.type,
        value: dto.value,
        reason: dto.reason
      }
    });
    await this.recalculateTotals(order.id);
    return this.getForTenant(order.id, ctx);
  }

  async applyPromotion(ctx: TenantContext, dto: ApplyPromotionDto) {
    const order = await this.getForTenant(dto.order_id, ctx);
    const now = new Date();
    const promo = await this.prisma.promotion.findFirst({
      where: {
        id: dto.promotion_id,
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        status: "active",
        startDate: { lte: now },
        endDate: { gte: now }
      },
      include: { rules: true }
    });
    if (!promo) throw new NotFoundException("Promotion not found or expired");

    let applied = false;
    for (const rule of promo.rules) {
      const condition = (rule.condition || {}) as Record<string, unknown>;
      const effect = (rule.effect || {}) as Record<string, unknown>;
      if (promo.scope === "total") {
        const minTotal = Number(condition.min_total || 0);
        if (Number(order.total) < minTotal) continue;
      }
      if (promo.scope === "item" && condition.menu_item_id) {
        const hasItem = order.items.some((i) => i.menuItemId === String(condition.menu_item_id));
        if (!hasItem) continue;
      }
      if (promo.scope === "category" && condition.category_id) {
        const match = await this.prisma.orderItem.findFirst({
          where: {
            orderId: order.id,
            menuItem: { categoryId: String(condition.category_id) }
          }
        });
        if (!match) continue;
      }

      let type: "percent" | "fixed" = "fixed";
      let value = 0;
      if (promo.promoType === "% off") {
        type = "percent";
        value = Number(effect.percent || 0);
      } else if (promo.promoType === "discount") {
        type = "fixed";
        value = Number(effect.amount || 0);
      } else if (promo.promoType === "BOGO") {
        type = "fixed";
        const cheapest = [...order.items].sort((a, b) => Number(a.lineTotal) - Number(b.lineTotal))[0];
        value = Number(cheapest?.lineTotal || 0);
      }
      if (value <= 0) continue;

      await this.prisma.orderDiscount.create({
        data: {
          orderId: order.id,
          type,
          value,
          reason: `promotion:${promo.name}`
        }
      });
      await this.prisma.promoAuditLog.create({
        data: {
          promotionId: promo.id,
          orderId: order.id,
          actorId: ctx.sub,
          action: "promotion_applied",
          metadata: { promo_type: promo.promoType, scope: promo.scope }
        }
      });
      applied = true;
      break;
    }
    if (!applied) throw new BadRequestException("Promotion condition not satisfied");

    await this.recalculateTotals(order.id);
    return this.getForTenant(order.id, ctx);
  }

  async sendKitchen(orderId: string, ctx: TenantContext) {
    const existing = await this.getForTenant(orderId, ctx);
    const order = await this.prisma.order.update({
      where: { id: existing.id },
      data: { status: "SENT_TO_KITCHEN" }
    });
    await this.prisma.orderItem.updateMany({
      where: { orderId: order.id, status: { not: "VOIDED" } },
      data: { status: "SENT_TO_KITCHEN", kitchenStatus: "SENT_TO_KITCHEN" }
    });
    await this.kdsService.createTicket(ctx, { order_id: order.id });
    this.realtimeGateway.emitKdsUpdate(order.branchId, orderId, "SENT_TO_KITCHEN");
    this.realtimeGateway.emitPosOrderUpdate(order.branchId, orderId);
    return this.get(orderId);
  }

  async transferTable(ctx: TenantContext, dto: TransferTableDto) {
    const order = await this.getForTenant(dto.order_id, ctx);
    const session = await this.prisma.tableSession.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        tableId: dto.to_table_id,
        openedAt: new Date(),
        status: "OPEN"
      }
    });
    await this.prisma.order.update({
      where: { id: order.id },
      data: { tableSessionId: session.id }
    });
    return this.getForTenant(order.id, ctx);
  }

  async splitOrder(ctx: TenantContext, dto: SplitOrderDto) {
    const source = await this.getForTenant(dto.order_id, ctx);
    const orderNumber = await this.nextOrderNumber(ctx.branch_id);
    const splitOrder = await this.prisma.order.create({
      data: {
        tenantId: source.tenantId,
        conceptId: source.conceptId,
        branchId: source.branchId,
        orderType: source.orderType,
        orderNumber,
        guestCount: source.guestCount,
        notes: `Split from ${source.orderNumber || source.id}`,
        openedBy: ctx.sub,
        openedAt: new Date(),
        channel: source.channel,
        status: "OPEN",
        subtotal: 0,
        tax: 0,
        service: 0,
        total: 0
      }
    });
    await this.prisma.orderItem.updateMany({
      where: { id: { in: dto.order_item_ids }, orderId: source.id },
      data: { orderId: splitOrder.id }
    });
    await this.recalculateTotals(source.id);
    await this.recalculateTotals(splitOrder.id);
    return {
      source: await this.getForTenant(source.id, ctx),
      split: await this.getForTenant(splitOrder.id, ctx)
    };
  }

  async voidItem(ctx: TenantContext, dto: VoidItemDto) {
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: dto.order_item_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!item) throw new NotFoundException("Order item not found");
    await this.prisma.orderItem.update({
      where: { id: item.id },
      data: { status: "VOIDED", lineTotal: 0 }
    });
    await this.recalculateTotals(item.orderId);
    return this.getForTenant(item.orderId, ctx);
  }

  async voidOrder(ctx: TenantContext, dto: VoidOrderDto) {
    const order = await this.getForTenant(dto.order_id, ctx);
    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId: order.id },
        data: { status: "VOIDED", lineTotal: 0 }
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: "VOIDED", subtotal: 0, tax: 0, service: 0, total: 0 }
      });
    });
    return this.getForTenant(order.id, ctx);
  }

  async activeOrders(ctx: TenantContext) {
    return this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id,
        status: { in: ["OPEN", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED", "BILLED"] }
      },
      include: { items: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async close(orderId: string, ctx: TenantContext) {
    const order = await this.getForConceptOrder(orderId, ctx);
    const paid = order.payments
      .filter((p) => p.status === "paid" || p.status === "refunded")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    if (paid + 0.0001 < Number(order.total)) {
      throw new BadRequestException("Order cannot close before full payment");
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "closed" }
      });

      await this.inventoryService.consumeForOrder(
        {
          tenantId: order.tenantId,
          conceptId: order.conceptId,
          branchId: order.branchId,
          orderId
        },
        tx
      );
    });
    this.realtimeGateway.emitSyncAvailable(order.branchId);
    this.realtimeGateway.emitPosOrderUpdate(order.branchId, orderId);

    return this.get(orderId);
  }

  async get(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { modifiers: true } }, payments: true, discounts: true, taxes: true }
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  async getForTenant(orderId: string, ctx: TenantContext) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      },
      include: { items: { include: { modifiers: true } }, payments: true, discounts: true, taxes: true }
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  /** Same tenant + concept as JWT (any branch) — for admin live board / cross-branch monitor. */
  async getForConceptOrder(orderId: string, ctx: TenantContext) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id
      },
      include: { items: { include: { modifiers: true } }, payments: true, discounts: true, taxes: true }
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  private async recalculateTotals(orderId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { menuItem: true }
    });
    const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
    const discounts = await this.prisma.orderDiscount.findMany({ where: { orderId } });
    let discountTotal = 0;
    for (const d of discounts) {
      if (d.type === "percent") {
        discountTotal += (subtotal * Number(d.value)) / 100;
      } else {
        discountTotal += Number(d.value);
      }
    }
    const netSubtotal = Math.max(0, subtotal - discountTotal);
    // Tax profile-aware tax calculation (default/reduced/zero), prorated after order-level discount.
    const tax = Number(
      items
        .reduce((acc, item) => {
          const line = Number(item.lineTotal);
          if (line <= 0 || subtotal <= 0) return acc;
          const proratedDiscount = (line / subtotal) * discountTotal;
          const netLine = Math.max(0, line - proratedDiscount);
          const rate = this.taxRateFromProfile(item.menuItem?.taxProfile);
          return acc + netLine * rate;
        }, 0)
        .toFixed(2)
    );
    const service = Number((subtotal * 0.1).toFixed(2));
    const total = Number((netSubtotal + tax + service).toFixed(2));

    await this.prisma.orderTax.deleteMany({ where: { orderId } });
    await this.prisma.orderTax.create({
      data: {
        orderId,
        taxName: "VAT",
        taxRate: 0.1,
        taxAmount: tax
      }
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { subtotal: netSubtotal, tax, service, total }
    });
  }

  private async nextOrderNumber(branchId: string) {
    const count = await this.prisma.order.count({ where: { branchId } });
    return `B${branchId.slice(0, 4).toUpperCase()}-${String(count + 1).padStart(6, "0")}`;
  }

  private taxRateFromProfile(profile?: string | null): number {
    const p = (profile || "default").toLowerCase();
    if (p === "zero" || p === "zero_rated" || p === "exempt") return 0;
    if (p === "reduced" || p === "reduced_5") return 0.05;
    if (p === "vat15" || p === "standard_15") return 0.15;
    return 0.1;
  }

  async listSections(ctx: TenantContext, branchIdParam?: string) {
    const branchId = await this.resolveMonitorBranchId(ctx, branchIdParam);
    return this.prisma.floor.findMany({
      where: { tenantId: ctx.tenant_id, branchId },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }]
    });
  }

  async createSection(ctx: TenantContext, dto: CreateSectionDto) {
    const branchId = await this.resolveMonitorBranchId(ctx, dto.branch_id);
    return this.prisma.floor.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId,
        name: dto.name.trim()
      }
    });
  }

  async updateSection(ctx: TenantContext, sectionId: string, dto: UpdateSectionDto) {
    const existing = await this.prisma.floor.findFirst({
      where: { id: sectionId, tenantId: ctx.tenant_id }
    });
    if (!existing) throw new NotFoundException("Section not found");
    return this.prisma.floor.update({
      where: { id: sectionId },
      data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}) }
    });
  }

  async listDiningTables(ctx: TenantContext, opts?: { branch_id?: string; floor_id?: string }) {
    const branchId = await this.resolveMonitorBranchId(ctx, opts?.branch_id);
    const tables = await this.prisma.diningTable.findMany({
      where: {
        tenantId: ctx.tenant_id,
        branchId,
        ...(opts?.floor_id ? { floorId: opts.floor_id } : {})
      },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }]
    });
    return this.withTableStatus(branchId, tables);
  }

  async createDiningTable(ctx: TenantContext, dto: CreateDiningTableDto) {
    const floor = await this.prisma.floor.findFirst({
      where: { id: dto.floor_id, tenantId: ctx.tenant_id, branchId: ctx.branch_id }
    });
    if (!floor) throw new NotFoundException("Section not found");
    const created = await this.prisma.diningTable.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: floor.branchId,
        floorId: floor.id,
        name: dto.name.trim(),
        seats: dto.seats ?? 2,
        isActive: true
      }
    });
    const [withState] = await this.withTableStatus(floor.branchId, [created]);
    return withState;
  }

  async updateDiningTable(ctx: TenantContext, tableId: string, dto: UpdateDiningTableDto) {
    const table = await this.prisma.diningTable.findFirst({
      where: { id: tableId, tenantId: ctx.tenant_id }
    });
    if (!table) throw new NotFoundException("Table not found");
    let nextFloorId = table.floorId;
    if (dto.floor_id) {
      const floor = await this.prisma.floor.findFirst({
        where: { id: dto.floor_id, tenantId: ctx.tenant_id, branchId: table.branchId }
      });
      if (!floor) throw new NotFoundException("Section not found");
      nextFloorId = floor.id;
    }
    const updated = await this.prisma.diningTable.update({
      where: { id: tableId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.seats !== undefined ? { seats: dto.seats } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
        floorId: nextFloorId
      }
    });
    const [withState] = await this.withTableStatus(table.branchId, [updated]);
    return withState;
  }

  async getTableLayout(ctx: TenantContext, branchIdParam?: string) {
    const branchId = await this.resolveMonitorBranchId(ctx, branchIdParam);
    const [sections, tables] = await Promise.all([
      this.prisma.floor.findMany({
        where: { tenantId: ctx.tenant_id, branchId },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }]
      }),
      this.prisma.diningTable.findMany({
        where: { tenantId: ctx.tenant_id, branchId },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }]
      })
    ]);
    const withState = await this.withTableStatus(branchId, tables);
    return {
      branch_id: branchId,
      sections: sections.map((s) => ({
        id: s.id,
        name: s.name,
        tables: withState.filter((t) => t.floorId === s.id)
      }))
    };
  }

  private async withTableStatus(
    branchId: string,
    tables: Array<{ id: string; floorId: string; name: string; seats: number; isActive: boolean }>
  ) {
    if (!tables.length) return [];
    const tableIds = tables.map((t) => t.id);
    const sessions = await this.prisma.tableSession.findMany({
      where: { branchId, tableId: { in: tableIds }, closedAt: null, status: "OPEN" },
      include: {
        orders: {
          where: { status: { in: ["OPEN", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED", "BILLED"] } },
          orderBy: { openedAt: "desc" },
          select: { id: true, status: true, orderNumber: true, openedAt: true, guestCount: true }
        }
      },
      orderBy: { openedAt: "desc" }
    });
    const byTable = new Map<string, (typeof sessions)[number]>();
    for (const s of sessions) {
      if (!byTable.has(s.tableId)) byTable.set(s.tableId, s);
    }
    return tables.map((t) => {
      const s = byTable.get(t.id);
      const activeOrder = s?.orders[0];
      const status = !t.isActive ? "inactive" : activeOrder ? "occupied" : s ? "reserved" : "available";
      return {
        id: t.id,
        floorId: t.floorId,
        name: t.name,
        seats: t.seats,
        isActive: t.isActive,
        status,
        active_order_id: activeOrder?.id || null,
        active_order_number: activeOrder?.orderNumber || null,
        active_order_status: activeOrder?.status || null,
        opened_at: activeOrder?.openedAt?.toISOString() || null,
        guest_count: activeOrder?.guestCount ?? null
      };
    });
  }

  async mergeOrders(ctx: TenantContext, sourceOrderId: string, targetOrderId: string) {
    const source = await this.getForTenant(sourceOrderId, ctx);
    const target = await this.getForTenant(targetOrderId, ctx);
    if (source.id === target.id) {
      throw new BadRequestException("Cannot merge an order with itself");
    }
    const movable = await this.prisma.orderItem.count({
      where: { orderId: source.id, status: { not: "VOIDED" } }
    });
    if (movable === 0) {
      throw new BadRequestException("Source order has no active lines to merge");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId: source.id, status: { not: "VOIDED" } },
        data: { orderId: target.id }
      });
      await tx.order.update({
        where: { id: source.id },
        data: { status: "VOIDED", subtotal: 0, tax: 0, service: 0, total: 0 }
      });
    });
    await this.recalculateTotals(target.id);
    return { target: await this.getForTenant(target.id, ctx) };
  }
}
