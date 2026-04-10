import { Module } from "@nestjs/common";
import { PosShiftController } from "./pos-shift.controller";
import { ShiftController } from "./shift.controller";
import { ShiftService } from "./shift.service";

@Module({
  controllers: [ShiftController, PosShiftController],
  providers: [ShiftService],
  exports: [ShiftService]
})
export class ShiftModule {}
