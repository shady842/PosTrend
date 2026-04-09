import { Controller, Get } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { SaasService } from "../saas/saas.service";

@Controller("tenant")
export class TenantController {
  constructor(private readonly saasService: SaasService) {}

  @Get("me")
  me(@CurrentTenant() ctx: TenantContext) {
    return this.saasService.tenantMe(ctx);
  }

  @Get("limits")
  limits(@CurrentTenant() ctx: TenantContext) {
    return this.saasService.limits(ctx);
  }

  @Get("subscription")
  subscription(@CurrentTenant() ctx: TenantContext) {
    return this.saasService.subscription(ctx);
  }

  @Get("bootstrap")
  getTenantBootstrap() {
    return {
      message: "Tenant bootstrap endpoint ready",
      phase: "phase-1"
    };
  }
}
