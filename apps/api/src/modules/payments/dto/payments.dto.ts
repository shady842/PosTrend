import { Type } from "class-transformer";
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class CreatePaymentDto {
  @IsString()
  method!: "cash" | "card" | "wallet" | "manual";

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class AddPaymentDto {
  @IsString()
  order_id!: string;

  @IsString()
  payment_method!: "cash" | "card" | "wallet" | "manual";

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  idempotency_key!: string;

  @IsString()
  @IsOptional()
  reference_id?: string;

  @IsString()
  @IsOptional()
  device_id?: string;

  @IsString()
  @IsOptional()
  customer_id?: string;

  @IsString()
  @IsOptional()
  @IsIn(["pending", "paid"])
  offline_status?: "pending" | "paid";
}

/** One leg of a split tender; [order_id] is taken from the parent [SplitPaymentDto]. */
export class SplitPaymentLineDto {
  @IsString()
  payment_method!: "cash" | "card" | "wallet" | "manual";

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  idempotency_key!: string;

  @IsString()
  @IsOptional()
  reference_id?: string;

  @IsString()
  @IsOptional()
  device_id?: string;

  @IsString()
  @IsOptional()
  customer_id?: string;

  @IsString()
  @IsOptional()
  @IsIn(["pending", "paid"])
  offline_status?: "pending" | "paid";
}

export class SplitPaymentDto {
  @IsString()
  order_id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitPaymentLineDto)
  splits!: SplitPaymentLineDto[];
}

export class RefundPaymentDto {
  @IsString()
  order_id!: string;

  @IsString()
  payment_id!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  manager_approved_by?: string;
}
