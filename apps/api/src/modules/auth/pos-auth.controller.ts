import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { DeviceLoginDto, RefreshDto } from "./dto/auth.dto";

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
}
