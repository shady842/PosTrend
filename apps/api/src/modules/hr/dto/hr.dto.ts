import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateEmployeeDto {
  @IsString()
  full_name!: string;

  @IsString()
  role_id!: string;

  @IsString()
  department_id!: string;

  @IsString()
  employment_type!: string;

  @IsIn(["active", "inactive"])
  status!: "active" | "inactive";

  @IsDateString()
  date_joined!: string;

  @IsOptional()
  @IsDateString()
  date_left?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;
}

export class AttendanceDto {
  @IsString()
  employee_id!: string;

  @IsDateString()
  clock_in!: string;

  @IsOptional()
  @IsDateString()
  clock_out?: string;

  @IsIn(["present", "absent", "late"])
  status!: "present" | "absent" | "late";
}

export class LeaveRequestDto {
  @IsString()
  employee_id!: string;

  @IsString()
  leave_type!: string;

  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  @IsIn(["pending", "approved", "rejected"])
  status!: "pending" | "approved" | "rejected";
}

export class PayrollProcessDto {
  @IsString()
  employee_id!: string;

  @IsDateString()
  period_start!: string;

  @IsDateString()
  period_end!: string;

  @IsNumber()
  @Min(0)
  gross_salary!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtime_hours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtime_rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  @IsIn(["draft", "processed", "paid"])
  status!: "draft" | "processed" | "paid";
}

export class CreateDepartmentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class LeaveDecisionDto {
  @IsIn(["approved", "rejected"])
  status!: "approved" | "rejected";
}

export class ListAttendanceDto {
  @IsOptional()
  @IsString()
  employee_id?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateHrShiftDto {
  @IsString()
  name!: string;

  @IsDateString()
  start_time!: string;

  @IsOptional()
  @IsDateString()
  end_time?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AssignShiftDto {
  @IsString()
  employee_id!: string;

  @IsString()
  shift_id!: string;

  @IsDateString()
  assignment_date!: string;
}

export class UploadEmployeeDocumentDto {
  @IsString()
  name!: string;
}
