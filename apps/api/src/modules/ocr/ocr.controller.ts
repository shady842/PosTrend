import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { OcrUploadDto, OcrVerifyDto } from "./dto/ocr.dto";
import { OcrService } from "./ocr.service";

@Controller("ocr")
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post("upload")
  upload(@CurrentTenant() ctx: TenantContext, @Body() dto: OcrUploadDto) {
    return this.ocrService.upload(ctx, dto);
  }

  @Get(":id")
  getById(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.ocrService.getOne(ctx, id);
  }

  @Post("verify")
  verify(@CurrentTenant() ctx: TenantContext, @Body() dto: OcrVerifyDto) {
    return this.ocrService.verify(ctx, dto);
  }
}
