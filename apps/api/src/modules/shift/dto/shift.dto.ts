import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class OpenShiftDto {
  @IsString()
  name!: string;

  @IsString()
  opened_by!: string;

  @IsNumber()
  @Min(0)
  starting_amount!: number;
}

export class CloseShiftDto {
  @IsString()
  shift_id!: string;

  @IsString()
  closed_by!: string;

  @IsNumber()
  @Min(0)
  ending_amount!: number;
}

export class CashDrawerMoveDto {
  @IsString()
  cash_drawer_id!: string;

  @IsIn(["in", "out"])
  type!: "in" | "out";

  @IsNumber()
  @Min(0.001)
  amount!: number;

  @IsString()
  reason!: string;

  @IsString()
  created_by!: string;
}

export class PerformDayCloseDto {
  @IsString()
  closed_by!: string;

  @IsOptional()
  @IsString()
  date?: string;
}
