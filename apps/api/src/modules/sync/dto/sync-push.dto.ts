import { Type } from "class-transformer";
import { IsArray, IsIn, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";

export class SyncPushOpDto {
  @IsIn(["order", "payment", "table", "shift"])
  domain!: "order" | "payment" | "table" | "shift";

  @IsString()
  type!: string;

  @IsString()
  idempotency_key!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class SyncPushRequestDto {
  @IsOptional()
  @IsString()
  device_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncPushOpDto)
  ops!: SyncPushOpDto[];
}
