import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { SaasService } from "../saas/saas.service";
import { DeviceLoginDto, LoginDto, RefreshDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly saasService: SaasService
  ) {}

  login(dto: LoginDto) {
    return this.saasService.login(dto.email, dto.password);
  }

  deviceLogin(dto: DeviceLoginDto) {
    return this.saasService.deviceLogin(dto.device_code, dto.device_secret, dto.device_name);
  }

  refresh(dto: RefreshDto) {
    const decoded = this.jwtService.verify(dto.refresh_token, {
      secret: process.env.JWT_SECRET || "dev-secret"
    });
    const payload =
      decoded.role === "super_admin"
        ? {
            sub: decoded.sub,
            role: "super_admin",
            super_admin_id: decoded.super_admin_id || decoded.sub
          }
        : {
            sub: decoded.sub,
            role: decoded.role,
            tenant_id: decoded.tenant_id,
            concept_id: decoded.concept_id,
            branch_id: decoded.branch_id,
            ...(decoded.impersonating_tenant ? { impersonating_tenant: true } : {}),
            ...(decoded.impersonated_by_super_admin
              ? { impersonated_by_super_admin: decoded.impersonated_by_super_admin }
              : {})
          };
    return {
      access_token: this.jwtService.sign(payload),
      token_type: "Bearer"
    };
  }
}
