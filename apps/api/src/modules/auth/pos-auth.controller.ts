import { Body, Controller, Post } from "@nestjs/common";
import { CurrentTenant } from "./decorators/tenant-context.decorator";
import { TenantContext } from "./types/tenant-context.type";
import { AuthService } from "./auth.service";
import { CashierLoginDto, DeviceLoginDto, RefreshDto } from "./dto/auth.dto";

@Controller("pos")
export class PosAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("device-login")
  deviceLogin(@Body() dto: DeviceLoginDto) {
    return this.authService.deviceLogin(dto);
  }

  @Post("device-refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post("cashier-login")
  cashierLogin(@CurrentTenant() ctx: TenantContext, @Body() dto: CashierLoginDto) {
    return this.authService.cashierLogin(ctx, dto);
  }

  @Post("cashier-logout")
  cashierLogout(@CurrentTenant() ctx: TenantContext) {
    return this.authService.cashierLogout(ctx);
  }
}
