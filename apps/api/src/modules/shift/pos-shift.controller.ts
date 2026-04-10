import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { ShiftService } from "./shift.service";

/** POS-facing shift analytics (no admin-only @Roles guard). */
@Controller("pos/shifts")
export class PosShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  /**
   * Sales / tax / discount / payment / item & category breakdown.
   * Default window: current open shift. Optional `from` / `to` ISO datetimes.
   */
  @Get("sales-report")
  @Permissions("pos.orders.open")
  async salesReport(
    @CurrentTenant() ctx: TenantContext,
    @Query("from") fromRaw?: string,
    @Query("to") toRaw?: string
  ) {
    const to = toRaw ? new Date(toRaw) : new Date();
    if (Number.isNaN(to.getTime())) {
      throw new BadRequestException("Invalid `to` datetime");
    }
    let from: Date;
    if (fromRaw) {
      from = new Date(fromRaw);
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException("Invalid `from` datetime");
      }
    } else {
      const cur = await this.shiftService.currentShift(ctx);
      if (!cur) {
        throw new BadRequestException(
          "No open shift — pass ?from= (and optional ?to=) for a custom period"
        );
      }
      const raw = cur.opened_at;
      from = raw instanceof Date ? raw : new Date(String(raw));
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException("Could not read shift start time");
      }
    }
    if (from > to) {
      throw new BadRequestException("`from` must be before `to`");
    }
    return this.shiftService.posSalesReport(ctx, from, to);
  }
}
