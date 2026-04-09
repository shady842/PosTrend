import { Module } from "@nestjs/common";
import { MenuController, PosMenuController } from "./menu.controller";
import { MenuService } from "./menu.service";

@Module({
  controllers: [MenuController, PosMenuController],
  providers: [MenuService],
  exports: [MenuService]
})
export class MenuModule {}
