import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";

export class StockAdjustmentDto {
  @IsString()
  inventory_item_id!: string;

  @IsNumber()
  qty!: number;

  @IsString()
  reason!: string;

  @IsString()
  adjusted_by!: string;
}

export class StockCountDto {
  @IsString()
  inventory_item_id!: string;

  @IsNumber()
  counted_qty!: number;
}

export class CreatePoLineDto {
  @IsString()
  inventory_item_id!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unit_price!: number;

  @IsOptional()
  @IsString()
  lot_number?: string;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplier_id!: string;

  @IsString()
  po_number!: string;

  @IsIn(["draft", "approved", "received"])
  status!: "draft" | "approved" | "received";

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePoLineDto)
  lines!: CreatePoLineDto[];
}

export class StockTransferDto {
  @IsString()
  to_branch_id!: string;

  @IsString()
  inventory_item_id!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsIn(["draft", "in_transit", "completed"])
  status!: "draft" | "in_transit" | "completed";
}

export class CreateInventoryItemDto {
  @IsString()
  name!: string;

  @IsString()
  sku!: string;

  @IsOptional()
  @IsString()
  uom_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reorder_point?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock_level?: number;

  /** When true, item applies to all branches (branchId null). Otherwise tied to the current branch. */
  @IsOptional()
  @IsBoolean()
  concept_wide?: boolean;
}

export class WastageDto {
  @IsString()
  inventory_item_id!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  reason!: string;

  @IsString()
  created_by!: string;
}

export class ProductionIngredientLineDto {
  @IsString()
  inventory_item_id!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

export class ProductionBuildDto {
  @IsString()
  finished_inventory_item_id!: string;

  @IsNumber()
  @Min(0.0001)
  build_qty!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yield_pct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waste_pct?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionIngredientLineDto)
  ingredient_lines!: ProductionIngredientLineDto[];
}
