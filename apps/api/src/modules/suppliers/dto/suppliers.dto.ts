import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";

export class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  contact_info?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branch_ids?: string[];
}

export class SupplierPoLineDto {
  @IsString()
  inventory_item_id!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unit_price!: number;
}

export class SupplierPurchaseOrderDto {
  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsString()
  po_number!: string;

  @IsIn(["draft", "approved", "received"])
  status!: "draft" | "approved" | "received";

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierPoLineDto)
  lines!: SupplierPoLineDto[];
}

export class SupplierBillDto {
  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsString()
  bill_no!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(["draft", "posted", "paid"])
  status!: "draft" | "posted" | "paid";

  @IsDateString()
  due_date!: string;

  @IsOptional()
  @IsString()
  actor_id?: string;
}
