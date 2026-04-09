import { IsArray, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  tenant_id!: string;

  @IsOptional()
  @IsString()
  concept_id!: string;

  @IsString()
  branch_id!: string;

  @IsString()
  channel!: "dine_in" | "takeaway" | "delivery";

  @IsOptional()
  @IsString()
  table_id?: string;
}

export class AddOrderItemDto {
  @IsOptional()
  @IsString()
  tenant_id!: string;

  @IsOptional()
  @IsString()
  concept_id!: string;

  @IsOptional()
  @IsString()
  branch_id!: string;

  @IsString()
  item_id!: string;

  @IsNumber()
  @Min(1)
  qty!: number;

  @IsArray()
  @IsOptional()
  modifiers?: string[];
}
