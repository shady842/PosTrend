import { IsIn, IsOptional, IsString } from "class-validator";

export class ForecastQueryDto {
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
  @IsIn(["daily", "intraday"])
  horizon?: "daily" | "intraday";
}
