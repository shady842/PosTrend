import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import type { SignOptions } from "jsonwebtoken";
import { APP_GUARD } from "@nestjs/core";
import { SaasModule } from "../saas/saas.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PosAuthController } from "./pos-auth.controller";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RolesGuard } from "./guards/roles.guard";

@Module({
  imports: [SaasModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-secret",
      signOptions: {
        expiresIn: (process.env.JWT_ACCESS_EXPIRES || "1h") as SignOptions["expiresIn"]
      }
    })
  ],
  controllers: [AuthController, PosAuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard
    }
  ]
})
export class AuthModule {}
