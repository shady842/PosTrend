import { Module } from "@nestjs/common";
import { HrController } from "./hr.controller";
import { HrService } from "./hr.service";
import { PostingModule } from "../posting/posting.module";

@Module({
  imports: [PostingModule],
  controllers: [HrController],
  providers: [HrService]
})
export class HrModule {}
