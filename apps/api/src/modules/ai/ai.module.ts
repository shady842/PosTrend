import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [AccountingModule],
  controllers: [AiController],
  providers: [AiService]
})
export class AiModule {}
