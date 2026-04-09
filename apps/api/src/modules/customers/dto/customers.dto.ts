import { IsOptional, IsString, IsNumber } from "class-validator";

export class CreateCustomerDto {
  @IsString()
  full_name!: string;

  @IsOptional()
  contact_info?: Record<string, unknown>;
}

export class LoyaltyTransactionDto {
  @IsString()
  customer_id!: string;

  @IsNumber()
  points!: number;

  @IsString()
  reason!: string;
}
