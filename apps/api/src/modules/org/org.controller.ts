import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import {
  CreateBranchDto,
  CreateConceptDto,
  CreateUserDto,
  RegisterDeviceDto,
  UpdateRolePermissionsDto,
  UpdateUserDto
} from "../saas/dto/signup.dto";
import { SaasService } from "../saas/saas.service";

@Controller()
export class OrgController {
  constructor(private readonly saasService: SaasService) {}

  @Get("concepts")
  getConcepts(@CurrentTenant() ctx: TenantContext) {
    return this.saasService.listConcepts(ctx);
  }

  @Post("concepts")
  createConcept(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateConceptDto) {
    return this.saasService.createConcept(ctx, dto);
  }

  @Get("branches")
  getBranches(@CurrentTenant() ctx: TenantContext) {
    return this.saasService.listBranches(ctx);
  }

  @Post("branches")
  createBranch(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateBranchDto) {
    return this.saasService.createBranch(ctx, dto);
  }

  @Post("devices/register")
  registerDevice(@CurrentTenant() ctx: TenantContext, @Body() dto: RegisterDeviceDto) {
    return this.saasService.registerDevice(ctx, dto);
  }

  @Get("devices")
  listDevices(@CurrentTenant() ctx: TenantContext) {
    return this.saasService.listDevices(ctx);
  }

  @Post("devices/:id/block")
  blockDevice(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.saasService.setDeviceStatus(ctx, id, "blocked");
  }

  @Post("devices/:id/unblock")
  unblockDevice(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.saasService.setDeviceStatus(ctx, id, "active");
  }

  @Post("devices/:id/rotate-secret")
  rotateDeviceSecret(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.saasService.rotateDeviceSecret(ctx, id);
  }

  @Get("users")
  listUsers(@CurrentTenant() ctx: TenantContext) {
    return this.saasService.listUsers(ctx);
  }

  @Post("users")
  createUser(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateUserDto) {
    return this.saasService.createUser(ctx, dto);
  }

  @Patch("users/:id")
  updateUser(@CurrentTenant() ctx: TenantContext, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.saasService.updateUser(ctx, id, dto);
  }

  @Post("users/:id/deactivate")
  deactivateUser(@CurrentTenant() ctx: TenantContext, @Param("id") id: string) {
    return this.saasService.deactivateUser(ctx, id);
  }

  @Get("roles/permissions")
  listRolePermissions(@CurrentTenant() ctx: TenantContext) {
    return this.saasService.listRolePermissions(ctx);
  }

  @Put("roles/:id/permissions")
  updateRolePermissions(@CurrentTenant() ctx: TenantContext, @Param("id") roleId: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.saasService.updateRolePermissions(ctx, roleId, dto.permission_keys);
  }

  @Get("branches/:branchId/settings")
  getBranchSettings(@Param("branchId") branchId: string) {
    return { branch_id: branchId, tax_profile: "default", service_charge: 0.1 };
  }
}
