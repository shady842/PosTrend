import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  display_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  branch_id?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  display_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ReorderCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  ordered_ids!: string[];
}

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  category_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsNumber()
  @Min(0)
  base_price!: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_combo?: boolean;

  @IsOptional()
  @IsString()
  kitchen_station_id?: string;

  @IsOptional()
  @IsString()
  tax_profile?: string;

  @IsOptional()
  @IsString()
  service_charge_rule?: string;

  @IsOptional()
  @IsInt()
  display_order?: number;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  base_price?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_combo?: boolean;

  @IsOptional()
  @IsString()
  kitchen_station_id?: string;

  @IsOptional()
  @IsString()
  tax_profile?: string;

  @IsOptional()
  @IsString()
  service_charge_rule?: string;

  @IsOptional()
  @IsInt()
  display_order?: number;
}

export class ReorderItemsDto {
  @IsString()
  @IsNotEmpty()
  category_id!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  ordered_ids!: string[];
}

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  menu_item_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class CreateModifierGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  min_select!: number;

  @IsInt()
  max_select!: number;

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;
}

export class CreateModifierOptionDto {
  @IsString()
  @IsNotEmpty()
  modifier_group_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  price!: number;

  @IsOptional()
  @IsInt()
  display_order?: number;
}

export class AttachItemModifierDto {
  @IsString()
  @IsNotEmpty()
  menu_item_id!: string;

  @IsString()
  @IsNotEmpty()
  modifier_group_id!: string;
}

export class PriceOverrideDto {
  @IsString()
  @IsNotEmpty()
  branch_id!: string;

  @IsString()
  @IsNotEmpty()
  menu_item_id!: string;

  @IsNumber()
  @Min(0)
  price_override!: number;
}

export class BranchPriceOverrideInputDto {
  @IsString()
  @IsNotEmpty()
  branch_id!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dine_in?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  takeaway?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  delivery?: number;
}

export class RecipeIngredientInputDto {
  @IsOptional()
  @IsString()
  inventory_item_id?: string;

  @IsOptional()
  @IsString()
  item_name?: string;

  @IsNumber()
  @Min(0)
  qty!: number;

  @IsOptional()
  @IsString()
  uom?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_cost?: number;
}

export class AdvancedInventoryInputDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  par_level?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorder_level?: number;

  @IsOptional()
  @IsBoolean()
  allow_negative?: boolean;
}

export class AdvancedAccountingInputDto {
  @IsOptional()
  @IsString()
  sales_account?: string;

  @IsOptional()
  @IsString()
  cogs_account?: string;

  @IsOptional()
  @IsString()
  inventory_account?: string;

  @IsOptional()
  @IsString()
  tax_account?: string;
}

export class UpsertItemAdvancedConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price_takeaway?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price_delivery?: number;

  @IsOptional()
  @IsBoolean()
  track_inventory?: boolean;

  @IsOptional()
  @IsBoolean()
  is_recipe_item?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchPriceOverrideInputDto)
  branch_price_overrides?: BranchPriceOverrideInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientInputDto)
  recipe_ingredients?: RecipeIngredientInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AdvancedInventoryInputDto)
  inventory?: AdvancedInventoryInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdvancedAccountingInputDto)
  accounting?: AdvancedAccountingInputDto;
}
