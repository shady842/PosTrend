import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { CreateKdsTicketDto, KdsEventDto, UpdateKdsTicketDto } from "./dto/kds.dto";
import { KdsService } from "./kds.service";

@Controller("kds")
export class KdsController {
  constructor(private readonly kdsService: KdsService) {}

  @Post("tickets")
  createTicket(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateKdsTicketDto) {
    return this.kdsService.createTicket(ctx, dto);
  }

  @Get("tickets/active")
  active(@CurrentTenant() ctx: TenantContext) {
    return this.kdsService.activeTickets(ctx);
  }

  @Get("stations")
  stations(@CurrentTenant() ctx: TenantContext, @Query("branch_id") branchId?: string) {
    return this.kdsService.listStations(ctx, branchId);
  }

  @Post("tickets/update")
  update(@CurrentTenant() ctx: TenantContext, @Body() dto: UpdateKdsTicketDto) {
    return this.kdsService.updateTicket(ctx, dto);
  }

  @Post("events")
  createEvent(@CurrentTenant() ctx: TenantContext, @Body() dto: KdsEventDto) {
    return this.kdsService.createEvent(ctx, dto);
  }
}
