import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { CreateKdsTicketDto, KdsEventDto, UpdateKdsTicketDto } from "./dto/kds.dto";

@Injectable()
export class KdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  private async ensureFallbackStationId(ctx: TenantContext, branchId: string): Promise<string> {
    let fallback = await this.prisma.kitchenStation.findFirst({
      where: { tenantId: ctx.tenant_id, branchId },
      orderBy: { name: "asc" }
    });
    if (!fallback) {
      fallback = await this.prisma.kitchenStation.create({
        data: {
          tenantId: ctx.tenant_id,
          branchId,
          name: "Main Kitchen"
        }
      });
    }
    return fallback.id;
  }

  private resolveItemStationFromRuleMaps(
    item: {
      menuItemId: string;
      menuItem: { categoryId: string | null; kitchenStationId: string | null };
    },
    byMenuItem: Map<string, string>,
    byCategory: Map<string, string>
  ): string | null {
    const fromItem = byMenuItem.get(item.menuItemId);
    if (fromItem) return fromItem;
    const cat = item.menuItem.categoryId;
    if (cat) {
      const fromCat = byCategory.get(cat);
      if (fromCat) return fromCat;
    }
    return item.menuItem.kitchenStationId || null;
  }

  private async loadKitchenRoutingMaps(
    branchId: string,
    menuItemIds: string[],
    categoryIds: string[]
  ): Promise<{ byMenuItem: Map<string, string>; byCategory: Map<string, string> }> {
    const uniqMenu = [...new Set(menuItemIds.filter(Boolean))];
    const uniqCat = [...new Set(categoryIds.filter(Boolean))];
    if (uniqMenu.length === 0 && uniqCat.length === 0) {
      return { byMenuItem: new Map(), byCategory: new Map() };
    }
    const rules = await this.prisma.kitchenRoutingRule.findMany({
      where: {
        branchId,
        OR: [{ menuItemId: { in: uniqMenu } }, { categoryId: { in: uniqCat } }]
      },
      orderBy: { id: "asc" }
    });
    const byMenuItem = new Map<string, string>();
    const byCategory = new Map<string, string>();
    for (const r of rules) {
      if (r.menuItemId && !byMenuItem.has(r.menuItemId)) byMenuItem.set(r.menuItemId, r.stationId);
      if (r.categoryId && !byCategory.has(r.categoryId)) byCategory.set(r.categoryId, r.stationId);
    }
    return { byMenuItem, byCategory };
  }

  async createTicket(ctx: TenantContext, dto: CreateKdsTicketDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.order_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      },
      include: {
        items: {
          include: { menuItem: true }
        }
      }
    });
    if (!order) throw new NotFoundException("Order not found");

    const sourceItems = dto.order_item_ids?.length
      ? order.items.filter((x) => dto.order_item_ids?.includes(x.id))
      : order.items;
    if (sourceItems.length === 0) {
      throw new NotFoundException("No items to send to kitchen");
    }

    const branchId = order.branchId;
    const menuItemIds = sourceItems.map((x) => x.menuItemId);
    const categoryIds = sourceItems.map((x) => x.menuItem.categoryId).filter((x): x is string => Boolean(x));
    const { byMenuItem, byCategory } = await this.loadKitchenRoutingMaps(branchId, menuItemIds, categoryIds);
    const fallbackId = await this.ensureFallbackStationId(ctx, branchId);

    const tickets = [];

    if (dto.station_id?.trim()) {
      const stationId = dto.station_id.trim();
      const stationOk = await this.prisma.kitchenStation.findFirst({
        where: { id: stationId, tenantId: ctx.tenant_id, branchId }
      });
      if (!stationOk) throw new NotFoundException("Station not found");
      const ticket = await this.prisma.kdsTicket.create({
        data: {
          orderId: order.id,
          stationId,
          status: "pending"
        }
      });
      tickets.push(ticket);
      await this.prisma.kdsEvent.create({
        data: {
          ticketId: ticket.id,
          eventType: "ticket_created",
          payload: {
            order_id: order.id,
            station_id: stationId,
            order_item_ids: sourceItems.map((x) => x.id),
            station_scope: "explicit"
          },
          status: "ack_pending"
        }
      });
    } else {
      const effectiveStationByItemId = new Map<string, string>();
      for (const it of sourceItems) {
        let sid = this.resolveItemStationFromRuleMaps(it, byMenuItem, byCategory);
        if (!sid) sid = fallbackId;
        effectiveStationByItemId.set(it.id, sid);
      }
      const stationIds = new Set(effectiveStationByItemId.values());
      const validStations = await this.prisma.kitchenStation.findMany({
        where: {
          id: { in: [...stationIds] },
          tenantId: ctx.tenant_id,
          branchId
        },
        select: { id: true }
      });
      const validSet = new Set(validStations.map((s) => s.id));
      for (const it of sourceItems) {
        const sid = effectiveStationByItemId.get(it.id)!;
        if (!validSet.has(sid)) {
          effectiveStationByItemId.set(it.id, fallbackId);
        }
      }
      const finalStationIds = new Set(effectiveStationByItemId.values());
      for (const stationId of finalStationIds) {
        const orderItemIds = sourceItems
          .filter((it) => effectiveStationByItemId.get(it.id) === stationId)
          .map((it) => it.id);
        if (orderItemIds.length === 0) continue;
        const ticket = await this.prisma.kdsTicket.create({
          data: {
            orderId: order.id,
            stationId,
            status: "pending"
          }
        });
        tickets.push(ticket);
        await this.prisma.kdsEvent.create({
          data: {
            ticketId: ticket.id,
            eventType: "ticket_created",
            payload: {
              order_id: order.id,
              station_id: stationId,
              order_item_ids: orderItemIds,
              station_scope: "routed"
            },
            status: "ack_pending"
          }
        });
      }
    }

    if (tickets.length > 0) {
      this.realtimeGateway.broadcastOrderSent(
        ctx.tenant_id,
        order.branchId,
        order.id,
        tickets.map((x) => x.id)
      );
    }
    this.realtimeGateway.broadcastOrderUpdated(ctx.tenant_id, order.branchId, order.id);

    return { order_id: order.id, tickets };
  }

  async activeTickets(ctx: TenantContext) {
    const tickets = await this.prisma.kdsTicket.findMany({
      where: {
        station: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id
        },
        status: { in: ["pending", "preparing", "ready"] }
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            tableSession: true
          }
        },
        station: true
      },
      orderBy: { createdAt: "asc" }
    });
    if (tickets.length === 0) return [];

    const orderIds = [...new Set(tickets.map((t) => t.orderId))];
    const ticketIds = tickets.map((t) => t.id);

    const [events, allOrderItems] = await Promise.all([
      this.prisma.kdsEvent.findMany({
        where: { ticketId: { in: ticketIds }, eventType: "ticket_created" },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.orderItem.findMany({
        where: {
          orderId: { in: orderIds },
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id
        },
        include: {
          menuItem: { select: { name: true, categoryId: true, kitchenStationId: true } }
        },
        orderBy: { createdAt: "asc" }
      })
    ]);

    const ticketMetaById = new Map<string, { order_item_ids: string[]; station_scope?: string }>();
    for (const ev of events) {
      const p = ev.payload as Record<string, unknown> | null;
      const raw = p?.order_item_ids;
      const ids = Array.isArray(raw)
        ? raw.map((x) => String(x)).filter((s) => s.length > 0)
        : [];
      const scope = p?.station_scope != null ? String(p.station_scope) : undefined;
      ticketMetaById.set(ev.ticketId, { order_item_ids: ids, station_scope: scope });
    }

    const branchId = ctx.branch_id;
    const menuItemIds = [...new Set(allOrderItems.map((i) => i.menuItemId))];
    const categoryIds = [
      ...new Set(
        allOrderItems.map((i) => i.menuItem?.categoryId).filter((x): x is string => Boolean(x))
      )
    ];
    const routeMaps = await this.loadKitchenRoutingMaps(branchId, menuItemIds, categoryIds);
    const fallbackStationId = await this.ensureFallbackStationId(ctx, branchId);
    const resolveLineStation = (it: (typeof allOrderItems)[number]) => {
      const sid = this.resolveItemStationFromRuleMaps(
        {
          menuItemId: it.menuItemId,
          menuItem: {
            categoryId: it.menuItem?.categoryId ?? null,
            kitchenStationId: it.menuItem?.kitchenStationId ?? null
          }
        },
        routeMaps.byMenuItem,
        routeMaps.byCategory
      );
      return sid || fallbackStationId;
    };

    const itemsByOrder = new Map<string, typeof allOrderItems>();
    for (const it of allOrderItems) {
      if (String(it.status ?? "").toUpperCase() === "VOIDED") continue;
      const list = itemsByOrder.get(it.orderId) ?? [];
      list.push(it);
      itemsByOrder.set(it.orderId, list);
    }

    const tableIds = [
      ...new Set(
        tickets
          .map((t) => t.order.tableSession?.tableId)
          .filter((id): id is string => Boolean(id))
      )
    ];
    const tables = tableIds.length
      ? await this.prisma.diningTable.findMany({
          where: { id: { in: tableIds }, tenantId: ctx.tenant_id, branchId: ctx.branch_id },
          select: { id: true, name: true, floorId: true }
        })
      : [];
    const floorIds = [...new Set(tables.map((t) => t.floorId).filter(Boolean))];
    const floors = floorIds.length
      ? await this.prisma.floor.findMany({
          where: { id: { in: floorIds }, tenantId: ctx.tenant_id, branchId: ctx.branch_id },
          select: { id: true, name: true }
        })
      : [];
    const tableMap = new Map(tables.map((t) => [t.id, t]));
    const floorMap = new Map(floors.map((f) => [f.id, f.name]));

    return tickets.map((t) => {
      const tableId = t.order.tableSession?.tableId || null;
      const table = tableId ? tableMap.get(tableId) : null;
      const sectionName = table?.floorId ? floorMap.get(table.floorId) || null : null;
      const pool = itemsByOrder.get(t.orderId) ?? [];
      const meta = ticketMetaById.get(t.id);
      const isExplicit = meta?.station_scope === "explicit";
      let lines = pool;
      if (isExplicit && (meta?.order_item_ids?.length ?? 0) > 0) {
        const want = new Set(meta!.order_item_ids);
        lines = pool.filter((i) => want.has(i.id));
      } else {
        lines = pool.filter((i) => resolveLineStation(i) === t.stationId);
      }
      return {
        id: t.id,
        order_id: t.orderId,
        order_number: t.order.orderNumber || null,
        table_label:
          table?.name ||
          (t.order.orderType === "TAKEAWAY"
            ? "Quick order"
            : t.order.orderType === "DELIVERY"
              ? "Delivery"
              : null),
        section_name: sectionName,
        status: t.status,
        created_at: t.createdAt.toISOString(),
        station: { id: t.station.id, name: t.station.name },
        items: lines.map((i) => ({
          id: i.id,
          name:
            (i.nameSnapshot || "").trim() ||
            (i.menuItem?.name || "").trim() ||
            "Item",
          qty: Number(i.qty),
          seat_no: i.seatNo,
          notes: i.notes || null,
          kitchen_status: i.kitchenStatus
        }))
      };
    });
  }

  async updateTicket(ctx: TenantContext, dto: UpdateKdsTicketDto) {
    const ticket = await this.prisma.kdsTicket.findFirst({
      where: {
        id: dto.ticket_id,
        station: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id
        }
      },
      include: { station: true }
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    const updated = await this.prisma.kdsTicket.update({
      where: { id: ticket.id },
      data: { status: dto.status }
    });
    const all = await this.prisma.kdsTicket.findMany({
      where: { orderId: ticket.orderId },
      select: { status: true }
    });
    const statuses = all.map((x) => x.status);
    let orderStatus = "SENT_TO_KITCHEN";
    if (statuses.every((s) => s === "served")) {
      orderStatus = "SERVED";
    } else if (statuses.every((s) => s === "ready" || s === "served")) {
      orderStatus = "READY";
    } else if (statuses.some((s) => s === "preparing")) {
      orderStatus = "PREPARING";
    }
    await this.prisma.order.update({
      where: { id: ticket.orderId },
      data: { status: orderStatus }
    });
    await this.prisma.orderItem.updateMany({
      where: { orderId: ticket.orderId, status: { not: "VOIDED" } },
      data: { status: orderStatus, kitchenStatus: orderStatus }
    });
    const branchId = ticket.station.branchId;
    const tenantId = ticket.station.tenantId;
    this.realtimeGateway.broadcastKdsUpdated(tenantId, branchId, ticket.id, ticket.orderId, dto.status);
    this.realtimeGateway.broadcastOrderUpdated(tenantId, branchId, ticket.orderId);
    if (dto.status === "preparing") {
      this.realtimeGateway.broadcastItemPreparing(tenantId, branchId, ticket.orderId, ticket.id);
    } else if (dto.status === "ready") {
      this.realtimeGateway.broadcastItemReady(tenantId, branchId, ticket.orderId, ticket.id);
    }
    return updated;
  }

  async listStations(ctx: TenantContext, branchIdParam?: string) {
    const branchId = (branchIdParam?.trim() || ctx.branch_id).trim();
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return this.prisma.kitchenStation.findMany({
      where: { tenantId: ctx.tenant_id, branchId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, branchId: true }
    });
  }

  async createEvent(ctx: TenantContext, dto: KdsEventDto) {
    const ticket = await this.prisma.kdsTicket.findFirst({
      where: {
        id: dto.ticket_id,
        station: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id
        }
      }
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return this.prisma.kdsEvent.create({
      data: {
        ticketId: dto.ticket_id,
        eventType: dto.event_type,
        payload: (dto.payload || {}) as Prisma.InputJsonValue,
        status: dto.status || "ack_pending"
      }
    });
  }
}
