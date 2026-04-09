import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { OcrController } from "./ocr.controller";
import { OcrService } from "./ocr.service";

@Module({
  imports: [AccountingModule],
  controllers: [OcrController],
  providers: [OcrService]
})
export class OcrModule {}
