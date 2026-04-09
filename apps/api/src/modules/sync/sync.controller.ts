import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { SyncPushRequestDto } from "./dto/sync-push.dto";
import { PosSyncService } from "./pos-sync.service";

@Controller("sync")
export class SyncController {
  constructor(private readonly posSyncService: PosSyncService) {}

  @Post("push")
  push(@CurrentTenant() ctx: TenantContext, @Body() dto: SyncPushRequestDto) {
    return this.posSyncService.push(ctx, dto);
  }

  @Get("pull")
  pull(@CurrentTenant() ctx: TenantContext, @Query("cursor") cursor?: string) {
    return this.posSyncService.pull(ctx, cursor);
  }
}
