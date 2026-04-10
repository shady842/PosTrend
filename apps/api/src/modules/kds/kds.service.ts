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

    const stationIds = new Set<string>();
    if (dto.station_id) {
      stationIds.add(dto.station_id);
    } else {
      for (const item of sourceItems) {
        const itemRule = await this.prisma.kitchenRoutingRule.findFirst({
          where: { branchId: ctx.branch_id, menuItemId: item.menuItemId }
        });
        if (itemRule?.stationId) {
          stationIds.add(itemRule.stationId);
          continue;
        }
        const categoryRule = item.menuItem.categoryId
          ? await this.prisma.kitchenRoutingRule.findFirst({
              where: { branchId: ctx.branch_id, categoryId: item.menuItem.categoryId }
            })
          : null;
        if (categoryRule?.stationId) {
          stationIds.add(categoryRule.stationId);
          continue;
        }
        if (item.menuItem.kitchenStationId) {
          stationIds.add(item.menuItem.kitchenStationId);
        }
      }
    }

    const ensureFallbackStation = async () => {
      let fallback = await this.prisma.kitchenStation.findFirst({
        where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id },
        orderBy: { name: "asc" }
      });
      if (!fallback) {
        fallback = await this.prisma.kitchenStation.create({
          data: {
            tenantId: ctx.tenant_id,
            branchId: ctx.branch_id,
            name: "Main Kitchen"
          }
        });
      }
      return fallback.id;
    };

    // Keep only valid station IDs for this tenant/branch to avoid FK failures.
    const requestedStationIds = [...stationIds];
    const validStations = requestedStationIds.length
      ? await this.prisma.kitchenStation.findMany({
          where: {
            id: { in: requestedStationIds },
            tenantId: ctx.tenant_id,
            branchId: ctx.branch_id
          },
          select: { id: true }
        })
      : [];
    const validStationIds = new Set(validStations.map((s) => s.id));
    stationIds.clear();
    for (const id of validStationIds) stationIds.add(id);

    if (stationIds.size === 0) {
      stationIds.add(await ensureFallbackStation());
    }

    const tickets = [];
    for (const stationId of stationIds) {
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
            order_item_ids: sourceItems.map((x) => x.id)
          },
          status: "ack_pending"
        }
      });
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
          include: { items: true, tableSession: true }
        },
        station: true
      },
      orderBy: { createdAt: "asc" }
    });
    if (tickets.length === 0) return [];

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
        items: t.order.items
          .filter((i) => i.status !== "VOIDED")
          .map((i) => ({
            id: i.id,
            name: (i.nameSnapshot || "").trim() || "Item",
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
