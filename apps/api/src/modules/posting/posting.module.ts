import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PostingController } from "./posting.controller";
import { PostingService } from "./posting.service";

@Module({
  imports: [AccountingModule],
  controllers: [PostingController],
  providers: [PostingService],
  exports: [PostingService]
})
export class PostingModule {}

