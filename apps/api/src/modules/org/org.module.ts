import { Module } from "@nestjs/common";
import { SaasModule } from "../saas/saas.module";
import { OrgController } from "./org.controller";

@Module({
  imports: [SaasModule],
  controllers: [OrgController]
})
export class OrgModule {}
