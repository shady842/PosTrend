import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import {
  AssignShiftDto,
  AttendanceDto,
  CreateDepartmentDto,
  CreateEmployeeDto,
  CreateHrShiftDto,
  LeaveDecisionDto,
  LeaveRequestDto,
  ListAttendanceDto,
  PayrollProcessDto,
  UploadEmployeeDocumentDto
} from "./dto/hr.dto";
import { HrService } from "./hr.service";

@Controller("hr")
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get("employees")
  employees(@CurrentTenant() ctx: TenantContext) {
    return this.hrService.getEmployees(ctx);
  }

  @Post("employees")
  createEmployee(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateEmployeeDto) {
    return this.hrService.createEmployee(ctx, dto);
  }

  @Post("employees/:id/documents")
  uploadEmployeeDocument(
    @CurrentTenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body() dto: UploadEmployeeDocumentDto
  ) {
    return this.hrService.uploadEmployeeDocument(ctx, id, dto);
  }

  @Get("employees/:id/documents")
  employeeDocuments(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.hrService.getEmployeeDocuments(ctx, id);
  }

  @Get("roles")
  roles(@CurrentTenant() ctx: TenantContext) {
    return this.hrService.getRoles(ctx);
  }

  @Get("departments")
  departments(@CurrentTenant() ctx: TenantContext) {
    return this.hrService.getDepartments(ctx);
  }

  @Post("departments")
  createDepartment(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateDepartmentDto) {
    return this.hrService.createDepartment(ctx, dto);
  }

  @Get("attendance")
  attendanceList(@CurrentTenant() ctx: TenantContext, @Query() q: ListAttendanceDto) {
    return this.hrService.getAttendance(ctx, q);
  }

  @Post("attendance")
  attendance(@CurrentTenant() ctx: TenantContext, @Body() dto: AttendanceDto) {
    return this.hrService.logAttendance(ctx, dto);
  }

  @Post("leave-request")
  leaveRequest(@CurrentTenant() ctx: TenantContext, @Body() dto: LeaveRequestDto) {
    return this.hrService.leaveRequest(ctx, dto);
  }

  @Get("leave-requests")
  leaveRequests(@CurrentTenant() ctx: TenantContext) {
    return this.hrService.getLeaveRequests(ctx);
  }

  @Post("leave-request/:id/decision")
  leaveDecision(@CurrentTenant() ctx: TenantContext, @Param("id") id: string, @Body() dto: LeaveDecisionDto) {
    return this.hrService.decideLeaveRequest(ctx, id, dto);
  }

  @Get("shifts")
  shifts(@CurrentTenant() ctx: TenantContext) {
    return this.hrService.getShifts(ctx);
  }

  @Post("shifts")
  createShift(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateHrShiftDto) {
    return this.hrService.createShift(ctx, dto);
  }

  @Get("shift-assignments")
  shiftAssignments(@CurrentTenant() ctx: TenantContext) {
    return this.hrService.getShiftAssignments(ctx);
  }

  @Post("shifts/assign")
  assignShift(@CurrentTenant() ctx: TenantContext, @Body() dto: AssignShiftDto) {
    return this.hrService.assignShift(ctx, dto);
  }

  @Get("payroll")
  payroll(@CurrentTenant() ctx: TenantContext) {
    return this.hrService.getPayroll(ctx);
  }

  @Post("payroll-process")
  payrollProcess(@CurrentTenant() ctx: TenantContext, @Body() dto: PayrollProcessDto) {
    return this.hrService.processPayroll(ctx, dto);
  }
}
