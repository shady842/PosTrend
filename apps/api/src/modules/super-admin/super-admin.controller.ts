import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CancelSubscriptionDto, ChangeSubscriptionDto, ConvertTrialDto, CreateBlogPostDto, CreatePlanDto, ExtendTrialDto, SuperAdminLoginDto, SuspendTenantDto, UpdateBlogPostDto, UpdatePlanDto, UpdatePlatformSettingDto, UpdateTenantDto } from "./dto/super-admin.dto";
import { SuperAdminService } from "./super-admin.service";
import { SuperAdminGuard } from "./super-admin.guard";

@Controller("super-admin")
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post("auth/login")
  login(@Body() dto: SuperAdminLoginDto) {
    return this.superAdminService.login(dto.email, dto.password);
  }

  @UseGuards(SuperAdminGuard)
  @Get("me")
  me(@Req() req: any) {
    return this.superAdminService.me(req.user?.super_admin_id || req.user?.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Get("dashboard")
  dashboard() {
    return this.superAdminService.dashboard();
  }

  @UseGuards(SuperAdminGuard)
  @Get("usage")
  usage(
    @Query("date_from") dateFrom?: string,
    @Query("date_to") dateTo?: string,
    @Query("plan") planId?: string,
    @Query("status") status?: string
  ) {
    return this.superAdminService.usageAnalytics({ dateFrom, dateTo, planId, status });
  }

  @UseGuards(SuperAdminGuard)
  @Get("logs")
  logs(
    @Query("tab") tab?: string,
    @Query("tenant") tenantId?: string,
    @Query("user") userId?: string,
    @Query("date_from") dateFrom?: string,
    @Query("date_to") dateTo?: string,
    @Query("action") action?: string,
    @Query("search") search?: string
  ) {
    return this.superAdminService.systemLogs({
      tab,
      tenantId,
      userId,
      dateFrom,
      dateTo,
      action,
      search
    });
  }

  @UseGuards(SuperAdminGuard)
  @Get("tenants")
  tenants() {
    return this.superAdminService.listTenants();
  }

  @UseGuards(SuperAdminGuard)
  @Get("tenants/:id")
  tenantDetails(@Param("id") id: string) {
    return this.superAdminService.getTenantDetails(id);
  }

  @UseGuards(SuperAdminGuard)
  @Patch("tenants/:id")
  updateTenant(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateTenantDto) {
    return this.superAdminService.updateTenant(id, dto, req.user?.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Post("tenants/:id/suspend")
  suspendTenant(@Req() req: any, @Param("id") id: string, @Body() dto: SuspendTenantDto) {
    return this.superAdminService.suspendTenant(id, dto.reason, req.user?.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Post("tenants/:id/activate")
  activateTenant(@Req() req: any, @Param("id") id: string) {
    return this.superAdminService.activateTenant(id, req.user?.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Post("tenants/:id/impersonate")
  impersonateTenant(@Req() req: any, @Param("id") id: string) {
    return this.superAdminService.impersonateTenant(id, req.user?.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Get("plans")
  plans() {
    return this.superAdminService.listPlans();
  }

  @UseGuards(SuperAdminGuard)
  @Get("trials")
  trials() {
    return this.superAdminService.listTrials();
  }

  @UseGuards(SuperAdminGuard)
  @Get("subscriptions")
  subscriptions() {
    return this.superAdminService.listSubscriptions();
  }

  @UseGuards(SuperAdminGuard)
  @Post("subscriptions/change")
  changeSubscription(@Req() req: any, @Body() dto: ChangeSubscriptionDto) {
    return this.superAdminService.changeSubscription(dto, req.user?.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Post("subscriptions/cancel")
  cancelSubscription(@Req() req: any, @Body() dto: CancelSubscriptionDto) {
    return this.superAdminService.cancelSubscription(dto, req.user?.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Post("trials/:tenantId/extend")
  extendTrial(@Param("tenantId") tenantId: string, @Body() dto: ExtendTrialDto) {
    return this.superAdminService.extendTrial(tenantId, dto.extend_days ?? 7);
  }

  @UseGuards(SuperAdminGuard)
  @Post("trials/:tenantId/convert")
  convertTrial(@Param("tenantId") tenantId: string, @Body() dto: ConvertTrialDto) {
    return this.superAdminService.convertTrial(tenantId, dto.plan_id);
  }

  @UseGuards(SuperAdminGuard)
  @Post("plans")
  createPlan(@Body() dto: CreatePlanDto) {
    return this.superAdminService.createPlan(dto);
  }

  @UseGuards(SuperAdminGuard)
  @Patch("plans/:id")
  updatePlan(@Param("id") id: string, @Body() dto: UpdatePlanDto) {
    return this.superAdminService.updatePlan(id, dto);
  }

  @UseGuards(SuperAdminGuard)
  @Get("settings")
  settings() {
    return this.superAdminService.settings();
  }

  @UseGuards(SuperAdminGuard)
  @Patch("settings")
  updateSettings(@Body() dto: UpdatePlatformSettingDto) {
    return this.superAdminService.updateSettings(dto);
  }

  @UseGuards(SuperAdminGuard)
  @Get("blog/posts")
  blogPosts() {
    return this.superAdminService.listBlogPostsAdmin();
  }

  @UseGuards(SuperAdminGuard)
  @Post("blog/posts")
  createBlogPost(@Req() req: any, @Body() dto: CreateBlogPostDto) {
    return this.superAdminService.createBlogPost(dto, req.user?.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Patch("blog/posts/:id")
  updateBlogPost(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateBlogPostDto) {
    return this.superAdminService.updateBlogPost(id, dto, req.user?.sub);
  }

  @UseGuards(SuperAdminGuard)
  @Post("blog/posts/:id/publish")
  publishBlogPost(@Req() req: any, @Param("id") id: string) {
    return this.superAdminService.publishBlogPost(id, req.user?.sub);
  }
}

