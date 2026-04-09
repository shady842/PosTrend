import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantContext } from "../auth/types/tenant-context.type";
import { PrismaService } from "../database/prisma.service";
import { PostingService } from "../posting/posting.service";
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

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: PostingService
  ) {}

  getEmployees(ctx: TenantContext) {
    return this.prisma.employee.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      },
      include: {
        role: true,
        department: true,
        branch: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  getRoles(ctx: TenantContext) {
    return this.prisma.role.findMany({
      where: { tenantId: ctx.tenant_id },
      orderBy: { name: "asc" }
    });
  }

  getDepartments(ctx: TenantContext) {
    return this.prisma.department.findMany({
      where: { tenantId: ctx.tenant_id },
      orderBy: { name: "asc" }
    });
  }

  createDepartment(ctx: TenantContext, dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: {
        tenantId: ctx.tenant_id,
        name: dto.name,
        description: dto.description
      }
    });
  }

  async createEmployee(ctx: TenantContext, dto: CreateEmployeeDto) {
    const role = await this.prisma.role.findFirst({
      where: { id: dto.role_id, tenantId: ctx.tenant_id }
    });
    if (!role) throw new NotFoundException("Role not found");
    const department = await this.prisma.department.findFirst({
      where: { id: dto.department_id, tenantId: ctx.tenant_id }
    });
    if (!department) throw new NotFoundException("Department not found");

    const employee = await this.prisma.employee.create({
      data: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: dto.branch_id || ctx.branch_id,
        fullName: dto.full_name,
        roleId: dto.role_id,
        departmentId: dto.department_id,
        employmentType: dto.employment_type,
        status: dto.status,
        dateJoined: new Date(dto.date_joined),
        dateLeft: dto.date_left ? new Date(dto.date_left) : null
      }
    });
    await this.audit(ctx, employee.id, "employee_created", { full_name: dto.full_name });
    return employee;
  }

  async uploadEmployeeDocument(ctx: TenantContext, employeeId: string, dto: UploadEmployeeDocumentDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId: ctx.tenant_id }
    });
    if (!employee) throw new NotFoundException("Employee not found");
    await this.audit(ctx, employee.id, "employee_document_uploaded", { name: dto.name });
    return { ok: true };
  }

  async getEmployeeDocuments(ctx: TenantContext, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
    });
    if (!employee) throw new NotFoundException("Employee not found");
    return this.prisma.hrAuditLog.findMany({
      where: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        employeeId,
        action: "employee_document_uploaded"
      },
      orderBy: { createdAt: "desc" }
    });
  }

  getAttendance(ctx: TenantContext, q: ListAttendanceDto) {
    return this.prisma.attendanceLog.findMany({
      where: {
        branchId: ctx.branch_id,
        employeeId: q.employee_id || undefined,
        checkIn: {
          gte: q.from ? new Date(q.from) : undefined,
          lte: q.to ? new Date(q.to) : undefined
        }
      },
      include: { employee: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async logAttendance(ctx: TenantContext, dto: AttendanceDto) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employee_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!employee) throw new NotFoundException("Employee not found");

    const dayStart = new Date(dto.clock_in);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const assignment = await this.prisma.employeeShiftAssignment.findFirst({
      where: {
        employeeId: employee.id,
        branchId: ctx.branch_id,
        assignmentDate: { gte: dayStart, lt: dayEnd }
      },
      include: { shift: true }
    });
    if (!assignment) {
      throw new BadRequestException("Attendance requires shift assignment");
    }
    if (assignment.shift.status !== "OPEN" && assignment.shift.status !== "CLOSED") {
      throw new BadRequestException("Shift state is invalid for attendance");
    }

    const attendance = await this.prisma.attendanceLog.create({
      data: {
        employeeId: employee.id,
        branchId: ctx.branch_id,
        shiftId: assignment.shiftId,
        checkIn: new Date(dto.clock_in),
        checkOut: dto.clock_out ? new Date(dto.clock_out) : null,
        status: dto.status
      }
    });
    await this.audit(ctx, employee.id, "attendance_logged", {
      attendance_id: attendance.id,
      status: dto.status
    });
    return attendance;
  }

  async leaveRequest(ctx: TenantContext, dto: LeaveRequestDto) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employee_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!employee) throw new NotFoundException("Employee not found");
    const request = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        branchId: ctx.branch_id,
        leaveType: dto.leave_type,
        startDate: new Date(dto.start_date),
        endDate: new Date(dto.end_date),
        status: dto.status
      }
    });
    await this.audit(ctx, employee.id, "leave_request_created", {
      leave_request_id: request.id,
      status: dto.status
    });
    return request;
  }

  getLeaveRequests(ctx: TenantContext) {
    return this.prisma.leaveRequest.findMany({
      where: {
        branchId: ctx.branch_id,
        employee: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id
        }
      },
      include: { employee: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async decideLeaveRequest(ctx: TenantContext, id: string, dto: LeaveDecisionDto) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        id,
        branchId: ctx.branch_id,
        employee: { tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
      },
      include: { employee: true }
    });
    if (!leave) throw new NotFoundException("Leave request not found");
    const updated = await this.prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { status: dto.status }
    });
    await this.audit(ctx, leave.employeeId, "leave_request_decided", { leave_request_id: leave.id, status: dto.status });
    return updated;
  }

  getShifts(ctx: TenantContext) {
    return this.prisma.shift.findMany({
      where: { tenantId: ctx.tenant_id, branchId: ctx.branch_id },
      orderBy: { startTime: "desc" }
    });
  }

  createShift(ctx: TenantContext, dto: CreateHrShiftDto) {
    return this.prisma.shift.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        name: dto.name,
        startTime: new Date(dto.start_time),
        endTime: dto.end_time ? new Date(dto.end_time) : null,
        status: dto.status || "OPEN"
      }
    });
  }

  getShiftAssignments(ctx: TenantContext) {
    return this.prisma.employeeShiftAssignment.findMany({
      where: {
        branchId: ctx.branch_id,
        employee: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id
        }
      },
      include: { employee: true, shift: true },
      orderBy: { assignmentDate: "desc" }
    });
  }

  async assignShift(ctx: TenantContext, dto: AssignShiftDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employee_id, tenantId: ctx.tenant_id, conceptId: ctx.concept_id, branchId: ctx.branch_id }
    });
    if (!employee) throw new NotFoundException("Employee not found");
    const shift = await this.prisma.shift.findFirst({
      where: { id: dto.shift_id, tenantId: ctx.tenant_id, branchId: ctx.branch_id }
    });
    if (!shift) throw new NotFoundException("Shift not found");
    return this.prisma.employeeShiftAssignment.create({
      data: {
        employeeId: employee.id,
        shiftId: shift.id,
        branchId: ctx.branch_id,
        assignmentDate: new Date(dto.assignment_date)
      }
    });
  }

  getPayroll(ctx: TenantContext) {
    return this.prisma.payrollRecord.findMany({
      where: {
        branchId: ctx.branch_id,
        employee: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id
        }
      },
      include: { employee: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async processPayroll(ctx: TenantContext, dto: PayrollProcessDto) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employee_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: ctx.branch_id
      }
    });
    if (!employee) throw new NotFoundException("Employee not found");

    const overtimePay = Number((dto.overtime_hours || 0) * (dto.overtime_rate || 0));
    const gross = Number(dto.gross_salary) + overtimePay;
    const deductions = Number(dto.deductions || 0);
    const tax = Number((gross * Number(dto.tax_rate || 0)).toFixed(2));
    const net = Number((gross - deductions - tax).toFixed(2));

    const payroll = await this.prisma.$transaction(async (tx) => {
      const record = await tx.payrollRecord.create({
        data: {
          employeeId: employee.id,
          branchId: employee.branchId,
          periodStart: new Date(dto.period_start),
          periodEnd: new Date(dto.period_end),
          grossSalary: gross,
          deductions: deductions + tax,
          netSalary: net,
          status: dto.status
        }
      });

      if (dto.status === "processed" || dto.status === "paid") {
        await this.posting.post(
          ctx,
          { type: "PAYROLL_PROCESSED", payroll_record_id: record.id },
          tx
        );
      }
      return record;
    });

    await this.audit(ctx, employee.id, "payroll_processed", {
      payroll_id: payroll.id,
      gross_salary: gross,
      net_salary: net,
      status: dto.status
    });
    return payroll;
  }

  private async audit(
    ctx: TenantContext,
    employeeId: string | null,
    action: string,
    metadata: Record<string, unknown>
  ) {
    await this.prisma.hrAuditLog.create({
      data: {
        tenantId: ctx.tenant_id,
        branchId: ctx.branch_id,
        employeeId: employeeId || undefined,
        actorId: ctx.sub,
        action,
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }
}
