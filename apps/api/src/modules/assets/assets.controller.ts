import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { AssetsService } from "./assets.service";
import {
  CreateAssetCategoryDto,
  CreateAssetDto,
  DepreciateAssetsDto,
  DisposeAssetDto
} from "./dto/assets.dto";

@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post("categories")
  createCategory(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateAssetCategoryDto) {
    return this.assetsService.createCategory(ctx, dto);
  }

  @Post()
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(ctx, dto);
  }

  @Get(":id")
  getById(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.assetsService.getOne(ctx, id);
  }

  @Post("depreciate")
  depreciate(@CurrentTenant() ctx: TenantContext, @Body() dto: DepreciateAssetsDto) {
    return this.assetsService.depreciate(ctx, dto);
  }

  @Post("dispose")
  dispose(@CurrentTenant() ctx: TenantContext, @Body() dto: DisposeAssetDto) {
    return this.assetsService.dispose(ctx, dto);
  }
}
