import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";

export class CreateJournalLineDto {
  @IsString()
  @IsOptional()
  account_id?: string;

  @IsString()
  @IsOptional()
  account_code?: string;

  @IsNumber()
  @Min(0)
  debit!: number;

  @IsNumber()
  @Min(0)
  credit!: number;

  @IsString()
  @IsOptional()
  reference_type?: string;

  @IsString()
  @IsOptional()
  reference_id?: string;
}

export class CreateJournalEntryDto {
  @IsDateString()
  date!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;

  @IsString()
  created_by!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}

export class CreateChartOfAccountDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"])
  type!: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsBoolean()
  concept_wide?: boolean;
}

export class ListJournalEntriesDto {
  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsBoolean()
  posted?: boolean;

  @IsOptional()
  @IsString()
  q?: string;
}

export class UpdateJournalEntryDto extends CreateJournalEntryDto {}

export class AccountingReportQueryDto {
  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  /** Default true (only posted entries) */
  @IsOptional()
  @IsString()
  posted_only?: string;

  @IsOptional()
  @IsString()
  account_id?: string;
}

export class CreateArInvoiceDto {
  @IsString()
  customer_id!: string;

  @IsString()
  @IsNotEmpty()
  invoice_no!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(["draft", "posted", "paid", "overdue"])
  status!: "draft" | "posted" | "paid" | "overdue";

  @IsDateString()
  due_date!: string;
}

export class CreateApBillDto {
  @IsString()
  vendor_id!: string;

  @IsString()
  @IsNotEmpty()
  bill_no!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(["draft", "posted", "paid"])
  status!: "draft" | "posted" | "paid";

  @IsDateString()
  due_date!: string;
}
