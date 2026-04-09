import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import type { SignOptions } from "jsonwebtoken";
import { PublicController } from "./public.controller";
import { SaasService } from "./saas.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-secret",
      signOptions: {
        expiresIn: (process.env.JWT_ACCESS_EXPIRES || "1h") as SignOptions["expiresIn"]
      }
    })
  ],
  controllers: [PublicController],
  providers: [SaasService],
  exports: [SaasService]
})
export class SaasModule {}
