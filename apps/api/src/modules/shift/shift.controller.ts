import { Body, Controller, Get, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { CashDrawerMoveDto, CloseShiftDto, OpenShiftDto, PerformDayCloseDto } from "./dto/shift.dto";
import { ShiftService } from "./shift.service";

@Controller()
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Get("shifts/current")
  current(@CurrentTenant() ctx: TenantContext) {
    return this.shiftService.currentShift(ctx);
  }

  @Post("shifts/open")
  open(@CurrentTenant() ctx: TenantContext, @Body() dto: OpenShiftDto) {
    return this.shiftService.openShift(ctx, dto);
  }

  @Post("shifts/close")
  close(@CurrentTenant() ctx: TenantContext, @Body() dto: CloseShiftDto) {
    return this.shiftService.closeShift(ctx, dto);
  }

  @Post("cash-drawers/move")
  cashMove(@CurrentTenant() ctx: TenantContext, @Body() dto: CashDrawerMoveDto) {
    return this.shiftService.moveCash(ctx, dto);
  }

  @Post("day-close/perform")
  @Roles("tenant_owner", "branch_manager")
  performDayClose(@CurrentTenant() ctx: TenantContext, @Body() dto: PerformDayCloseDto) {
    return this.shiftService.performDayClose(ctx, dto);
  }

  @Post("day-close")
  @Roles("tenant_owner", "branch_manager")
  performDayCloseAlias(@CurrentTenant() ctx: TenantContext, @Body() dto: PerformDayCloseDto) {
    return this.shiftService.performDayClose(ctx, dto);
  }

  @Get("day-close/summary")
  @Roles("tenant_owner", "branch_manager")
  dayCloseSummary(@CurrentTenant() ctx: TenantContext) {
    return this.shiftService.dayCloseSummary(ctx);
  }

  @Get("day-close/reports")
  dayCloseReports(@CurrentTenant() ctx: TenantContext) {
    return this.shiftService.dayCloseReports(ctx);
  }
}
