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

export class OcrLineDto {
  @IsOptional()
  @IsString()
  inventory_item_id?: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unit_price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @IsNumber()
  @Min(0)
  total!: number;
}

export class OcrUploadDto {
  @IsString()
  file_url!: string;

  @IsOptional()
  @IsString()
  supplier_name?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OcrLineDto)
  lines?: OcrLineDto[];
}

export class OcrVerifyDto {
  @IsString()
  ocr_upload_id!: string;

  @IsIn(["po", "bill", "inventory_receipt"])
  post_as!: "po" | "bill" | "inventory_receipt";

  @IsOptional()
  @IsString()
  supplier_name?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OcrLineDto)
  lines?: OcrLineDto[];
}
