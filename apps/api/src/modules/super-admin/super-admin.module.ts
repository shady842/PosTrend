import { Module, OnModuleInit } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { SuperAdminController } from "./super-admin.controller";
import { SuperAdminService } from "./super-admin.service";

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-secret"
    })
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  exports: [SuperAdminService]
})
export class SuperAdminModule implements OnModuleInit {
  constructor(private readonly superAdminService: SuperAdminService) {}
  async onModuleInit() {
    await this.superAdminService.ensureBootstrapOwner();
  }
}

