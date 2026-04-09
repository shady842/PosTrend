import { IsIn, IsOptional, IsString } from "class-validator";

export class AnalyticsFilterDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  concept_id?: string;

  @IsOptional()
  @IsString()
  staff_id?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  page_size?: string;

  @IsOptional()
  @IsIn(["csv", "xlsx"])
  export?: "csv" | "xlsx";

  @IsOptional()
  @IsString()
  refresh_seconds?: string;
}
