import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

export class ImportBankTransactionLineDto {
  @IsDateString()
  date!: string;

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsIn(["credit", "debit"])
  type!: "credit" | "debit";

  @IsOptional()
  @IsString()
  reference?: string;
}

export class ImportBankTransactionsDto {
  @IsString()
  bank_account_id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportBankTransactionLineDto)
  transactions!: ImportBankTransactionLineDto[];
}

export class ReconcileAdjustmentDto {
  @IsString()
  transaction_id!: string;

  @IsString()
  reason!: string;
}

export class ReconcileBankDto {
  @IsString()
  bank_account_id!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transaction_ids?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReconcileAdjustmentDto)
  adjustments?: ReconcileAdjustmentDto[];
}
