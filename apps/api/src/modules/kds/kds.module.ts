import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { KdsController } from "./kds.controller";
import { KdsService } from "./kds.service";

@Module({
  imports: [RealtimeModule],
  controllers: [KdsController],
  providers: [KdsService],
  exports: [KdsService]
})
export class KdsModule {}
