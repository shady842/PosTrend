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

    const stationIds = new Set<string>();
    if (dto.station_id) {
      stationIds.add(dto.station_id);
    } else {
      for (const item of order.items) {
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

    if (stationIds.size === 0) {
      throw new NotFoundException("No routing station found for order");
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
          payload: { order_id: order.id, station_id: stationId },
          status: "ack_pending"
        }
      });
    }

    return { order_id: order.id, tickets };
  }

  async activeTickets(ctx: TenantContext) {
    return this.prisma.kdsTicket.findMany({
      where: {
        station: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id
        },
        status: { in: ["pending", "preparing", "ready"] }
      },
      include: {
        order: {
          include: { items: true }
        },
        station: true
      },
      orderBy: { createdAt: "asc" }
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
    const orderStatusMap: Record<string, string> = {
      pending: "SENT_TO_KITCHEN",
      preparing: "PREPARING",
      ready: "READY",
      served: "SERVED"
    };
    await this.prisma.order.update({
      where: { id: ticket.orderId },
      data: { status: orderStatusMap[dto.status] || "SENT_TO_KITCHEN" }
    });
    await this.prisma.orderItem.updateMany({
      where: { orderId: ticket.orderId, status: { not: "VOIDED" } },
      data: { status: orderStatusMap[dto.status] || "SENT_TO_KITCHEN", kitchenStatus: orderStatusMap[dto.status] || "SENT_TO_KITCHEN" }
    });
    this.realtimeGateway.emitKdsUpdate(ticket.station.branchId, ticket.id, dto.status);
    this.realtimeGateway.emitPosOrderUpdate(ticket.station.branchId, ticket.orderId);
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
