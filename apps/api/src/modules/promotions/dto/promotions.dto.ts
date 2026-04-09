import { IsArray, IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class CreatePromotionDto {
  @IsString()
  name!: string;

  @IsIn(["discount", "BOGO", "% off"])
  promo_type!: "discount" | "BOGO" | "% off";

  @IsIn(["item", "category", "total"])
  scope!: "item" | "category" | "total";

  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  @IsIn(["active", "inactive"])
  status!: "active" | "inactive";

  @IsOptional()
  branch_id?: string;

  @IsArray()
  rules!: Array<{ condition: Record<string, unknown>; effect: Record<string, unknown> }>;
}
