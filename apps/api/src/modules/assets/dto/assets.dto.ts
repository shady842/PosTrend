import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateAssetCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateAssetDto {
  @IsString()
  name!: string;

  @IsString()
  category_id!: string;

  @IsDateString()
  purchase_date!: string;

  @IsNumber()
  @Min(0)
  purchase_cost!: number;

  @IsNumber()
  @Min(1)
  useful_life_months!: number;

  @IsIn(["straight-line", "reducing_balance"])
  depreciation_method!: "straight-line" | "reducing_balance";
}

export class DepreciateAssetsDto {
  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  as_of_date?: string;
}

export class DisposeAssetDto {
  @IsString()
  asset_id!: string;

  @IsNumber()
  proceeds!: number;

  @IsOptional()
  @IsDateString()
  disposal_date?: string;
}
