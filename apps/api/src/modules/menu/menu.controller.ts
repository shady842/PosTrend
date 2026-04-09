import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query
} from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import {
  AttachItemModifierDto,
  CreateCategoryDto,
  CreateItemDto,
  CreateModifierGroupDto,
  CreateModifierOptionDto,
  CreateVariantDto,
  PriceOverrideDto,
  ReorderCategoriesDto,
  ReorderItemsDto,
  UpsertItemAdvancedConfigDto,
  UpdateCategoryDto,
  UpdateItemDto
} from "./dto/menu.dto";
import { MenuService } from "./menu.service";

@Controller("menu")
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post("categories")
  createCategory(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(ctx, dto);
  }

  @Get("categories")
  getCategories(@CurrentTenant() ctx: TenantContext) {
    return this.menuService.listCategories(ctx);
  }

  @Patch("categories/:id")
  patchCategory(
    @CurrentTenant() ctx: TenantContext,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateCategoryDto
  ) {
    return this.menuService.updateCategory(ctx, id, dto);
  }

  @Post("categories/reorder")
  reorderCategories(@CurrentTenant() ctx: TenantContext, @Body() dto: ReorderCategoriesDto) {
    return this.menuService.reorderCategories(ctx, dto);
  }

  @Post("items")
  createItem(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateItemDto) {
    return this.menuService.createItem(ctx, dto);
  }

  @Get("items")
  getItems(
    @CurrentTenant() ctx: TenantContext,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("category_id") category_id?: string
  ) {
    return this.menuService.listItems(ctx, {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      category_id
    });
  }

  @Patch("items/:id")
  patchItem(
    @CurrentTenant() ctx: TenantContext,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateItemDto
  ) {
    return this.menuService.updateItem(ctx, id, dto);
  }

  @Post("items/reorder")
  reorderItems(@CurrentTenant() ctx: TenantContext, @Body() dto: ReorderItemsDto) {
    return this.menuService.reorderItems(ctx, dto);
  }

  @Get("modifier-groups")
  getModifierGroups(@CurrentTenant() ctx: TenantContext) {
    return this.menuService.listModifierGroups(ctx);
  }

  @Post("variants")
  createVariant(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateVariantDto) {
    return this.menuService.createVariant(ctx, dto);
  }

  @Post("modifier-groups")
  createModifierGroup(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateModifierGroupDto) {
    return this.menuService.createModifierGroup(ctx, dto);
  }

  @Post("modifier-options")
  createModifierOption(@Body() dto: CreateModifierOptionDto) {
    return this.menuService.createModifierOption(dto);
  }

  @Post("item-modifiers")
  attachItemModifier(@CurrentTenant() ctx: TenantContext, @Body() dto: AttachItemModifierDto) {
    return this.menuService.attachItemModifier(dto);
  }

  @Delete("item-modifiers/:id")
  detachItemModifier(
    @CurrentTenant() ctx: TenantContext,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string
  ) {
    return this.menuService.detachItemModifier(ctx, id);
  }

  @Post("price-overrides")
  setPriceOverride(@Body() dto: PriceOverrideDto) {
    return this.menuService.setPriceOverride(dto);
  }

  @Get("items/:id/advanced-config")
  getItemAdvancedConfig(
    @CurrentTenant() ctx: TenantContext,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string
  ) {
    return this.menuService.getItemAdvancedConfig(ctx, id);
  }

  @Put("items/:id/advanced-config")
  upsertItemAdvancedConfig(
    @CurrentTenant() ctx: TenantContext,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpsertItemAdvancedConfigDto
  ) {
    return this.menuService.upsertItemAdvancedConfig(ctx, id, dto);
  }
}

@Controller("pos")
export class PosMenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get("menu")
  getPosMenu(@CurrentTenant() ctx: TenantContext) {
    return this.menuService.getPosMenu(ctx);
  }
}
