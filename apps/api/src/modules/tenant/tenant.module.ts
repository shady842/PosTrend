import { Module } from "@nestjs/common";
import { SaasModule } from "../saas/saas.module";
import { TenantController } from "./tenant.controller";

@Module({
  imports: [SaasModule],
  controllers: [TenantController]
})
export class TenantModule {}
