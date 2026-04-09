import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CancelSubscriptionDto, ChangeSubscriptionDto, CreateBlogPostDto, CreatePlanDto, UpdateBlogPostDto, UpdatePlanDto, UpdateTenantDto } from "./dto/super-admin.dto";

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.superAdminUser.findUnique({ where: { email: normalized } });
    if (!user || user.status !== "active" || !this.verifySecret(password, user.passwordHash)) {
      throw new ForbiddenException("Invalid credentials");
    }
    await this.prisma.superAdminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    const payload = {
      sub: user.id,
      role: "super_admin",
      super_admin_id: user.id
    };
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: "7d" }),
      token_type: "Bearer"
    };
  }

  me(superAdminId: string) {
    return this.prisma.superAdminUser.findUnique({
      where: { id: superAdminId },
      select: { id: true, email: true, fullName: true, status: true, lastLoginAt: true, createdAt: true }
    });
  }

  async dashboard() {
    const activeTenants = await this.prisma.tenant.findMany({
      where: { status: { in: ["active", "trial"] } },
      select: { id: true }
    });
    const tenantIds = activeTenants.map((t) => t.id);
    const [activeSubs, plans, users, devices] = await Promise.all([
      this.prisma.tenantSubscription.count({ where: { status: "active", tenantId: { in: tenantIds } } }),
      this.prisma.subscriptionPlan.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { tenantId: { in: tenantIds } } }),
      this.prisma.device.count({ where: { tenantId: { in: tenantIds } } })
    ]);
    return {
      totals: {
        tenants: tenantIds.length,
        active_subscriptions: activeSubs,
        active_plans: plans,
        tenant_users: users,
        devices
      }
    };
  }

  async usageAnalytics(filters: {
    dateFrom?: string;
    dateTo?: string;
    planId?: string;
    status?: string;
  }) {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const to = filters.dateTo ? new Date(filters.dateTo) : new Date();
    to.setHours(23, 59, 59, 999);

    const tenantWhere: Prisma.TenantWhereInput = {
      ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
      ...(filters.planId && filters.planId !== "all" ? { planId: filters.planId } : {})
    };

    const tenants = await this.prisma.tenant.findMany({
      where: tenantWhere,
      include: {
        branches: { select: { id: true } },
        users: { select: { id: true } },
        plans: true
      },
      orderBy: { createdAt: "asc" }
    });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length === 0) {
      return {
        metrics: {
          total_tenants: 0,
          active_tenants: 0,
          trials: 0,
          mrr: 0,
          arr: 0,
          active_devices: 0,
          orders_per_day: 0,
          api_calls: 0
        },
        charts: {
          tenants_growth: [],
          revenue_growth: [],
          plan_distribution: [],
          usage_per_tenant: []
        },
        table: []
      };
    }

    const [devices, orders, apiCalls, activeSubs] = await Promise.all([
      this.prisma.device.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { id: true, tenantId: true, status: true, lastSeenAt: true }
      }),
      this.prisma.order.findMany({
        where: { tenantId: { in: tenantIds }, createdAt: { gte: from, lte: to } },
        select: { id: true, tenantId: true, createdAt: true, updatedAt: true }
      }),
      this.prisma.syncOutbox.count({
        where: { tenantId: { in: tenantIds }, createdAt: { gte: from, lte: to } }
      }),
      this.prisma.tenantSubscription.findMany({
        where: { tenantId: { in: tenantIds }, status: "active" },
        include: { plan: true },
        orderBy: { startsAt: "desc" }
      })
    ]);

    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
    const activeDevices = devices.filter((d) => d.status === "active").length;
    const activeTenants = tenants.filter((t) => t.status === "active").length;
    const trialTenants = tenants.filter((t) => t.status === "trial").length;
    const ordersPerDay = Number((orders.length / days).toFixed(2));

    const latestActiveSubByTenant = new Map<string, (typeof activeSubs)[number]>();
    for (const s of activeSubs) {
      if (!latestActiveSubByTenant.has(s.tenantId)) latestActiveSubByTenant.set(s.tenantId, s);
    }
    const mrr = Number(
      Array.from(latestActiveSubByTenant.values())
        .reduce((sum, s) => sum + Number(s.plan?.priceMonthly || 0), 0)
        .toFixed(2)
    );
    const arr = Number((mrr * 12).toFixed(2));

    const tenantsGrowth = tenants.map((t, i) => ({
      date: t.createdAt.toISOString().slice(0, 10),
      count: i + 1
    }));

    const revenueByMonth = new Map<string, number>();
    for (const s of latestActiveSubByTenant.values()) {
      const month = s.startsAt.toISOString().slice(0, 7);
      revenueByMonth.set(month, Number((revenueByMonth.get(month) || 0) + Number(s.plan?.priceMonthly || 0)));
    }
    const revenueGrowth = [...revenueByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue: Number(revenue.toFixed(2)) }));

    const planDistMap = new Map<string, number>();
    for (const t of tenants) {
      const plan = t.plans?.name || t.plan || "Unknown";
      planDistMap.set(plan, (planDistMap.get(plan) || 0) + 1);
    }
    const planDistribution = [...planDistMap.entries()].map(([name, value]) => ({ name, value }));

    const ordersByTenant = new Map<string, number>();
    const lastOrderAtByTenant = new Map<string, Date>();
    for (const o of orders) {
      ordersByTenant.set(o.tenantId, (ordersByTenant.get(o.tenantId) || 0) + 1);
      const prev = lastOrderAtByTenant.get(o.tenantId);
      if (!prev || o.updatedAt > prev) lastOrderAtByTenant.set(o.tenantId, o.updatedAt);
    }
    const activeDevicesByTenant = new Map<string, number>();
    const lastDeviceAtByTenant = new Map<string, Date>();
    for (const d of devices) {
      if (d.status === "active") {
        activeDevicesByTenant.set(d.tenantId, (activeDevicesByTenant.get(d.tenantId) || 0) + 1);
      }
      if (d.lastSeenAt) {
        const prev = lastDeviceAtByTenant.get(d.tenantId);
        if (!prev || d.lastSeenAt > prev) lastDeviceAtByTenant.set(d.tenantId, d.lastSeenAt);
      }
    }

    const usagePerTenant = tenants.map((t) => ({
      tenant: t.name,
      devices: activeDevicesByTenant.get(t.id) || 0,
      orders: ordersByTenant.get(t.id) || 0
    }));

    const table = tenants.map((t) => {
      const ordersCount = ordersByTenant.get(t.id) || 0;
      const devicesCount = activeDevicesByTenant.get(t.id) || 0;
      const storageMb = Number((ordersCount * 0.04 + devicesCount * 0.2 + t.users.length * 0.01).toFixed(2));
      const lastActivity = [lastOrderAtByTenant.get(t.id), lastDeviceAtByTenant.get(t.id)]
        .filter(Boolean)
        .sort((a, b) => (a!.getTime() > b!.getTime() ? -1 : 1))[0];
      return {
        tenant: t.name,
        branches: t.branches.length,
        devices: devicesCount,
        orders: ordersCount,
        storage_mb: storageMb,
        last_activity: lastActivity || null,
        plan: t.plans?.name || t.plan,
        status: t.status
      };
    });

    return {
      metrics: {
        total_tenants: tenants.length,
        active_tenants: activeTenants,
        trials: trialTenants,
        mrr,
        arr,
        active_devices: activeDevices,
        orders_per_day: ordersPerDay,
        api_calls: apiCalls
      },
      charts: {
        tenants_growth: tenantsGrowth,
        revenue_growth: revenueGrowth,
        plan_distribution: planDistribution,
        usage_per_tenant: usagePerTenant
      },
      table
    };
  }

  async systemLogs(filters: {
    tab?: string;
    tenantId?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    action?: string;
    search?: string;
  }) {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = filters.dateTo ? new Date(filters.dateTo) : new Date();
    to.setHours(23, 59, 59, 999);
    const tab = (filters.tab || "audit").toLowerCase();

    const [tenants, users, sa, hr, acc, rep, pay, promo] = await Promise.all([
      this.prisma.tenant.findMany({ select: { id: true, name: true } }),
      this.prisma.user.findMany({ select: { id: true, email: true, fullName: true } }),
      this.prisma.superAdminAuditLog.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.hrAuditLog.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.accountingAuditLog.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.reportAuditLog.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.paymentAuditLog.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.promoAuditLog.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" }, take: 500 })
    ]);

    const tenantById = new Map(tenants.map((t) => [t.id, t.name]));
    const userById = new Map(users.map((u) => [u.id, u.fullName || u.email]));

    const rows: Array<{
      id: string;
      timestamp: Date;
      tenant: string;
      tenant_id: string;
      user: string;
      user_id: string;
      action: string;
      status: string;
      ip: string;
      source: string;
      payload: unknown;
    }> = [];

    for (const x of sa) rows.push({
      id: x.id, timestamp: x.createdAt, tenant: tenantById.get(x.tenantId) || "-", tenant_id: x.tenantId, user: userById.get(x.actorId || "") || "-", user_id: x.actorId || "", action: x.action, status: /FAIL|ERROR|REJECT/i.test(x.action) ? "failed" : "success", ip: "-", source: "audit", payload: x.metadata
    });
    for (const x of hr) rows.push({
      id: x.id, timestamp: x.createdAt, tenant: tenantById.get(x.tenantId) || "-", tenant_id: x.tenantId, user: userById.get(x.actorId || "") || "-", user_id: x.actorId || "", action: x.action, status: /FAIL|ERROR|REJECT/i.test(x.action) ? "failed" : "success", ip: "-", source: "tenant", payload: x.metadata
    });
    for (const x of acc) rows.push({
      id: x.id, timestamp: x.createdAt, tenant: tenantById.get(x.tenantId) || "-", tenant_id: x.tenantId, user: userById.get(x.actorId || "") || "-", user_id: x.actorId || "", action: `${x.action}:${x.entityType}`, status: /FAIL|ERROR|REJECT/i.test(x.action) ? "failed" : "success", ip: "-", source: "error", payload: x.metadata
    });
    for (const x of rep) rows.push({
      id: x.id, timestamp: x.createdAt, tenant: tenantById.get(x.tenantId) || "-", tenant_id: x.tenantId, user: userById.get(x.actorId || "") || "-", user_id: x.actorId || "", action: `REPORT_${x.reportType}`, status: "success", ip: "-", source: "api", payload: x.filters
    });
    for (const x of pay) rows.push({
      id: x.id, timestamp: x.createdAt, tenant: tenantById.get(x.tenantId) || "-", tenant_id: x.tenantId, user: userById.get(x.actorId || "") || "-", user_id: x.actorId || "", action: x.action, status: /FAIL|ERROR|REJECT/i.test(x.action) ? "failed" : "success", ip: "-", source: "api", payload: x.metadata
    });
    for (const x of promo) rows.push({
      id: x.id, timestamp: x.createdAt, tenant: "-", tenant_id: "", user: userById.get(x.actorId || "") || "-", user_id: x.actorId || "", action: x.action, status: /FAIL|ERROR|REJECT/i.test(x.action) ? "failed" : "success", ip: "-", source: "tenant", payload: x.metadata
    });

    let filtered = rows;
    if (tab === "auth") filtered = filtered.filter((r) => /AUTH|LOGIN|IMPERSONAT/i.test(r.action));
    else if (tab === "tenant") filtered = filtered.filter((r) => r.source === "tenant" || /TENANT_/i.test(r.action));
    else if (tab === "api") filtered = filtered.filter((r) => r.source === "api");
    else if (tab === "error") filtered = filtered.filter((r) => r.status === "failed" || r.source === "error");
    else filtered = filtered.filter((r) => r.source === "audit" || r.source === "tenant" || r.source === "api" || r.source === "error");

    if (filters.tenantId && filters.tenantId !== "all") filtered = filtered.filter((r) => r.tenant_id === filters.tenantId);
    if (filters.userId && filters.userId !== "all") filtered = filtered.filter((r) => r.user_id === filters.userId);
    if (filters.action) filtered = filtered.filter((r) => r.action.toLowerCase().includes(filters.action!.toLowerCase()));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((r) =>
        r.action.toLowerCase().includes(q) ||
        r.tenant.toLowerCase().includes(q) ||
        r.user.toLowerCase().includes(q) ||
        JSON.stringify(r.payload || "").toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
    return {
      data: filtered.slice(0, 500).map((r) => ({
        ...r,
        timestamp: r.timestamp.toISOString()
      })),
      tenants: tenants.map((t) => ({ id: t.id, name: t.name })),
      users: users.map((u) => ({ id: u.id, name: u.fullName || u.email }))
    };
  }

  async listTenants() {
    const rows = await this.prisma.tenant.findMany({
      include: {
        concepts: { select: { id: true } },
        branches: { select: { id: true } },
        users: { select: { id: true, email: true } },
        subscriptions: {
          orderBy: { startsAt: "desc" },
          take: 1,
          include: { plan: true }
        },
        _count: {
          select: { branches: true, users: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    const devicesCount = await this.prisma.device.groupBy({
      by: ["tenantId"],
      _count: { _all: true }
    });
    const devicesByTenant = new Map<string, number>(
      devicesCount.map((d) => [d.tenantId, d._count._all])
    );
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      owner_email: t.users[0]?.email || "",
      slug: t.slug,
      status: t.status,
      plan: t.subscriptions[0]?.plan?.name || t.plan,
      plan_id: t.subscriptions[0]?.planId || t.planId || null,
      trial_end: t.subscriptions[0]?.trialEndsAt || t.trialEndsAt || null,
      created_at: t.createdAt,
      branches_count: t._count.branches,
      devices_count: devicesByTenant.get(t.id) || 0,
      users_count: t._count.users
    }));
  }

  async getTenantDetails(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        branches: {
          include: { devices: { select: { id: true, deviceCode: true, status: true, lastSeenAt: true } } },
          orderBy: { name: "asc" }
        },
        users: {
          select: { id: true, fullName: true, email: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" }
        },
        subscriptions: {
          orderBy: { startsAt: "desc" },
          take: 12,
          include: { plan: true }
        }
      }
    });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const devices = tenant.branches.flatMap((b) =>
      b.devices.map((d) => ({
        id: d.id,
        branch_id: b.id,
        branch_name: b.name,
        code: d.deviceCode,
        status: d.status,
        last_seen_at: d.lastSeenAt
      }))
    );

    return {
      general_info: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        suspension_reason: tenant.suspensionReason,
        suspended_at: tenant.suspendedAt,
        cancelled_at: tenant.cancelledAt,
        owner_email: tenant.users[0]?.email || "",
        created_at: tenant.createdAt
      },
      plan_info: {
        current_plan: tenant.subscriptions[0]?.plan?.name || tenant.plan,
        current_plan_id: tenant.subscriptions[0]?.planId || tenant.planId || null,
        trial_end: tenant.subscriptions[0]?.trialEndsAt || tenant.trialEndsAt || null
      },
      usage: {
        branches_count: tenant.branches.length,
        devices_count: devices.length,
        users_count: tenant.users.length
      },
      branches: tenant.branches.map((b) => ({
        id: b.id,
        name: b.name,
        timezone: b.timezone,
        currency: b.currency,
        devices_count: b.devices.length
      })),
      devices,
      users: tenant.users.map((u) => ({
        id: u.id,
        full_name: u.fullName,
        email: u.email,
        status: u.status,
        created_at: u.createdAt
      })),
      subscription_history: tenant.subscriptions.map((s) => ({
        id: s.id,
        plan_id: s.planId,
        plan_name: s.plan?.name || "",
        status: s.status,
        starts_at: s.startsAt,
        ends_at: s.endsAt,
        trial_ends_at: s.trialEndsAt
      })),
      audit_log: await this.prisma.superAdminAuditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 30
      })
    };
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto, actorId?: string) {
    const existing = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) throw new NotFoundException("Tenant not found");
    let resolvedPlanCode: string | undefined;
    if (dto.plan_id) {
      const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.plan_id } });
      if (!plan) throw new NotFoundException("Subscription plan not found");
      resolvedPlanCode = plan.code;
    }
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.plan_id !== undefined
          ? {
              planId: dto.plan_id || null,
              plan: resolvedPlanCode || existing.plan
            }
          : {}),
        ...(dto.trial_ends_at !== undefined ? { trialEndsAt: new Date(dto.trial_ends_at) } : {})
        ,
        ...(dto.suspension_reason !== undefined ? { suspensionReason: dto.suspension_reason || null } : {})
      }
    });
    if (dto.plan_id) {
      const latest = await this.prisma.tenantSubscription.findFirst({
        where: { tenantId, status: { in: ["active", "trial"] } },
        orderBy: { startsAt: "desc" }
      });
      if (latest) {
        await this.prisma.tenantSubscription.update({
          where: { id: latest.id },
          data: { planId: dto.plan_id }
        });
      }
    }
    if (dto.status && ["cancelled", "past_due", "suspended", "active", "trial"].includes(dto.status)) {
      await this.audit(
        tenantId,
        `TENANT_STATUS_${dto.status.toUpperCase()}`,
        actorId,
        dto.suspension_reason || undefined,
        { from: existing.status, to: dto.status }
      );
    }
    return { id: updated.id, status: updated.status, name: updated.name };
  }

  async suspendTenant(tenantId: string, reason?: string, actorId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "suspended", suspensionReason: reason || "Suspended by super admin", suspendedAt: new Date() }
    });
    await this.audit(tenantId, "TENANT_SUSPENDED", actorId, reason);
    return { id: tenantId, status: "suspended" };
  }

  async activateTenant(tenantId: string, actorId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "active", suspensionReason: null, suspendedAt: null }
    });
    await this.audit(tenantId, "TENANT_ACTIVATED", actorId);
    return { id: tenantId, status: "active" };
  }

  async impersonateTenant(tenantId: string, actorId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const assignment = await this.prisma.userRoleAssignment.findFirst({
      where: { tenantId },
      include: { user: true, role: true },
      orderBy: { id: "asc" }
    });
    if (!assignment?.user) throw new NotFoundException("No tenant user available for impersonation");

    const payload = {
      sub: assignment.user.id,
      role: assignment.role?.code || "tenant_owner",
      tenant_id: tenant.id,
      concept_id: assignment.conceptId || assignment.user.conceptId || "",
      branch_id: assignment.branchId || assignment.user.branchId || "",
      impersonating_tenant: true,
      impersonated_by_super_admin: actorId || null
    };
    await this.audit(tenantId, "TENANT_IMPERSONATION_STARTED", actorId, undefined, {
      user_id: assignment.user.id,
      role: payload.role
    });
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: "7d" }),
      token_type: "Bearer",
      impersonation: {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        user_id: assignment.user.id,
        user_email: assignment.user.email
      }
    };
  }

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: "desc" }
    });
  }

  async listTrials() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        users: { select: { email: true }, take: 1, orderBy: { createdAt: "asc" } },
        subscriptions: { orderBy: { startsAt: "desc" }, take: 1, include: { plan: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);
    const in7d = new Date(startToday);
    in7d.setDate(in7d.getDate() + 7);

    const rows = tenants.map((t) => {
      const sub = t.subscriptions[0];
      const trialStart = t.trialStartsAt || sub?.startsAt || t.createdAt;
      const trialEnd = t.trialEndsAt || sub?.trialEndsAt || null;
      const daysLeft = trialEnd
        ? Math.ceil((new Date(trialEnd).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      const converted = t.status === "active" && !!sub && sub.status === "active";
      return {
        tenant_id: t.id,
        tenant: t.name,
        owner_email: t.users[0]?.email || "",
        trial_start: trialStart,
        trial_end: trialEnd,
        days_left: daysLeft,
        plan: sub?.plan?.name || t.plan,
        status: t.status,
        converted_to_paid: converted
      };
    });

    return {
      widgets: {
        expiring_today: rows.filter((r) => r.trial_end && new Date(r.trial_end) >= startToday && new Date(r.trial_end) < endToday).length,
        expiring_in_7_days: rows.filter((r) => r.days_left !== null && r.days_left >= 0 && r.days_left <= 7).length,
        expired_trials: rows.filter((r) => r.days_left !== null && r.days_left < 0).length,
        converted_to_paid: rows.filter((r) => r.converted_to_paid).length
      },
      data: rows
    };
  }

  async listSubscriptions() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        subscriptions: { orderBy: { startsAt: "desc" }, take: 1, include: { plan: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const invoices = await this.prisma.tenantSubscription.findMany({
      include: { tenant: { select: { name: true } }, plan: true },
      orderBy: { startsAt: "desc" },
      take: 100
    });

    const table = tenants.map((t) => {
      const s = t.subscriptions[0];
      const cycle = (s?.providerRef || "monthly").toLowerCase();
      const amount =
        Number(
          cycle === "yearly" ? s?.plan?.priceYearly ?? 0 : s?.plan?.priceMonthly ?? 0
        ) || 0;
      return {
        tenant_id: t.id,
        tenant: t.name,
        plan_id: s?.planId || t.planId || null,
        plan: s?.plan?.name || t.plan,
        amount,
        billing_cycle: cycle,
        next_billing_date: s?.endsAt || null,
        status: s?.status || t.status
      };
    });

    return {
      table,
      invoices: invoices.map((s) => ({
        id: s.id,
        tenant: s.tenant.name,
        plan: s.plan.name,
        amount: Number((s.providerRef || "monthly").toLowerCase() === "yearly" ? s.plan.priceYearly : s.plan.priceMonthly),
        cycle: s.providerRef || "monthly",
        status: s.status,
        starts_at: s.startsAt,
        ends_at: s.endsAt
      }))
    };
  }

  async changeSubscription(dto: ChangeSubscriptionDto, actorId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenant_id } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.plan_id } });
    if (!plan) throw new NotFoundException("Plan not found");

    const cycle = (dto.billing_cycle || "monthly").toLowerCase();
    const now = new Date();
    const nextBilling = dto.next_billing_date
      ? new Date(dto.next_billing_date)
      : new Date(now.getTime() + (cycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000);

    const latest = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId: tenant.id, status: { in: ["active", "trial", "past_due"] } },
      orderBy: { startsAt: "desc" }
    });
    if (latest) {
      await this.prisma.tenantSubscription.update({
        where: { id: latest.id },
        data: { status: "replaced", endsAt: now }
      });
    }

    const sub = await this.prisma.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: "active",
        startsAt: now,
        endsAt: nextBilling,
        billingProvider: "manual",
        providerRef: cycle
      }
    });
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "active", planId: plan.id, plan: plan.code, cancelledAt: null }
    });
    await this.audit(tenant.id, "SUBSCRIPTION_CHANGED", actorId, undefined, {
      plan_id: plan.id,
      cycle,
      amount: dto.amount ?? Number(cycle === "yearly" ? plan.priceYearly : plan.priceMonthly)
    });
    return { subscription_id: sub.id, tenant_id: tenant.id, status: "active" };
  }

  async cancelSubscription(dto: CancelSubscriptionDto, actorId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenant_id } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const latest = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId: tenant.id, status: { in: ["active", "trial", "past_due"] } },
      orderBy: { startsAt: "desc" }
    });
    const now = new Date();
    if (latest) {
      await this.prisma.tenantSubscription.update({
        where: { id: latest.id },
        data: { status: "cancelled", endsAt: now }
      });
    }
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "cancelled", cancelledAt: now }
    });
    await this.audit(tenant.id, "SUBSCRIPTION_CANCELLED", actorId, dto.reason);
    return { tenant_id: tenant.id, status: "cancelled" };
  }

  async extendTrial(tenantId: string, extendDays: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const base = tenant.trialEndsAt || new Date();
    const next = new Date(base);
    next.setDate(next.getDate() + extendDays);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "trial", trialEndsAt: next }
    });
    const latestSub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { startsAt: "desc" }
    });
    if (latestSub) {
      await this.prisma.tenantSubscription.update({
        where: { id: latestSub.id },
        data: { status: "trial", trialEndsAt: next }
      });
    }
    return { tenant_id: tenantId, trial_end: next, status: "trial" };
  }

  async convertTrial(tenantId: string, planId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    let targetPlanId = planId || tenant.planId || null;
    let targetPlanCode = tenant.plan;
    if (targetPlanId) {
      const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: targetPlanId } });
      if (!plan) throw new NotFoundException("Plan not found");
      targetPlanCode = plan.code;
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "active", planId: targetPlanId, plan: targetPlanCode }
    });
    const latestSub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { startsAt: "desc" }
    });
    if (latestSub) {
      await this.prisma.tenantSubscription.update({
        where: { id: latestSub.id },
        data: { status: "active", planId: targetPlanId || latestSub.planId, trialEndsAt: latestSub.trialEndsAt }
      });
    }
    return { tenant_id: tenantId, status: "active", plan_id: targetPlanId };
  }

  createPlan(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        code: dto.code,
        trialDays: dto.trial_days,
        priceMonthly: dto.price_monthly,
        priceYearly: dto.price_yearly,
        maxBranches: dto.max_branches,
        maxConcepts: dto.max_concepts,
        maxDevices: dto.max_devices,
        maxUsers: dto.max_users,
        maxItems: dto.max_items,
        isActive: dto.is_active ?? true
      }
    });
  }

  async updatePlan(planId: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found");
    return this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.trial_days !== undefined ? { trialDays: dto.trial_days } : {}),
        ...(dto.price_monthly !== undefined ? { priceMonthly: dto.price_monthly } : {}),
        ...(dto.price_yearly !== undefined ? { priceYearly: dto.price_yearly } : {}),
        ...(dto.max_branches !== undefined ? { maxBranches: dto.max_branches } : {}),
        ...(dto.max_concepts !== undefined ? { maxConcepts: dto.max_concepts } : {}),
        ...(dto.max_devices !== undefined ? { maxDevices: dto.max_devices } : {}),
        ...(dto.max_users !== undefined ? { maxUsers: dto.max_users } : {}),
        ...(dto.max_items !== undefined ? { maxItems: dto.max_items } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {})
      }
    });
  }

  async listBlogPostsAdmin() {
    const rows = await this.prisma.blogPost.findMany({
      include: {
        categories: { include: { category: true } },
        tags: { include: { tag: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      status: p.status,
      author_name: p.authorName,
      author_email: p.authorEmail,
      seo_title: p.seoTitle,
      seo_description: p.seoDescription,
      og_image: p.ogImage,
      content: p.content,
      published_at: p.publishedAt,
      created_at: p.createdAt,
      categories: p.categories.map((c) => c.category.name),
      tags: p.tags.map((t) => t.tag.name)
    }));
  }

  async createBlogPost(dto: CreateBlogPostDto, actorId?: string) {
    const me = actorId ? await this.prisma.superAdminUser.findUnique({ where: { id: actorId } }) : null;
    const baseSlug = this.slugify(dto.slug || dto.title);
    const slug = await this.ensureUniqueBlogSlug(baseSlug);
    const post = await this.prisma.blogPost.create({
      data: {
        slug,
        title: dto.title,
        excerpt: dto.excerpt || null,
        content: dto.content,
        seoTitle: dto.seo_title || null,
        seoDescription: dto.seo_description || null,
        ogImage: dto.og_image || null,
        status: "draft",
        authorName: me?.fullName || "Platform Owner",
        authorEmail: me?.email || "owner@postrend.local"
      }
    });
    await this.syncBlogPostTaxonomy(post.id, dto.categories || [], dto.tags || []);
    return this.prisma.blogPost.findUnique({ where: { id: post.id } });
  }

  async updateBlogPost(postId: string, dto: UpdateBlogPostDto, actorId?: string) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id: postId } });
    if (!existing) throw new NotFoundException("Blog post not found");
    const nextSlug = dto.slug || dto.title ? await this.ensureUniqueBlogSlug(this.slugify(dto.slug || dto.title || existing.slug), postId) : undefined;
    const updated = await this.prisma.blogPost.update({
      where: { id: postId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt || null } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.seo_title !== undefined ? { seoTitle: dto.seo_title || null } : {}),
        ...(dto.seo_description !== undefined ? { seoDescription: dto.seo_description || null } : {}),
        ...(dto.og_image !== undefined ? { ogImage: dto.og_image || null } : {}),
        ...(nextSlug ? { slug: nextSlug } : {})
      }
    });
    if (dto.categories || dto.tags) {
      await this.syncBlogPostTaxonomy(postId, dto.categories || [], dto.tags || []);
    }
    return updated;
  }

  async publishBlogPost(postId: string, actorId?: string) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id: postId } });
    if (!existing) throw new NotFoundException("Blog post not found");
    const updated = await this.prisma.blogPost.update({
      where: { id: postId },
      data: { status: "published", publishedAt: new Date() }
    });
    return updated;
  }

  async settings() {
    const rows = await this.prisma.platformSetting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      system_name: (map.system_name as string | undefined) || "PosTrend Platform",
      support_email: (map.support_email as string | undefined) || "support@postrend.local",
      maintenance_mode: (map.maintenance_mode as string | undefined) || "off",
      default_trial_days: Number(map.default_trial_days ?? 14),
      default_plan_id: (map.default_plan_id as string | undefined) || "",
      smtp_host: (map.smtp_host as string | undefined) || "",
      smtp_port: Number(map.smtp_port ?? 587),
      smtp_user: (map.smtp_user as string | undefined) || "",
      smtp_password: (map.smtp_password as string | undefined) || "",
      smtp_from_email: (map.smtp_from_email as string | undefined) || "",
      smtp_from_name: (map.smtp_from_name as string | undefined) || "",
      storage_driver: (map.storage_driver as string | undefined) || "local",
      storage_bucket: (map.storage_bucket as string | undefined) || "",
      storage_region: (map.storage_region as string | undefined) || "",
      storage_base_url: (map.storage_base_url as string | undefined) || "",
      branding_app_name: (map.branding_app_name as string | undefined) || "PosTrend",
      branding_logo_url: (map.branding_logo_url as string | undefined) || "",
      feature_inventory: Boolean(map.feature_inventory ?? true),
      feature_billing: Boolean(map.feature_billing ?? true),
      feature_reports: Boolean(map.feature_reports ?? true),
      feature_hr: Boolean(map.feature_hr ?? true),
      feature_promotions: Boolean(map.feature_promotions ?? true),
      global_tax_default: Number(map.global_tax_default ?? 0),
      currency_default: (map.currency_default as string | undefined) || "USD",
      timezone_default: (map.timezone_default as string | undefined) || "UTC"
    };
  }

  async updateSettings(input: {
    system_name?: string;
    support_email?: string;
    maintenance_mode?: string;
    default_trial_days?: number;
    default_plan_id?: string;
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_password?: string;
    smtp_from_email?: string;
    smtp_from_name?: string;
    storage_driver?: string;
    storage_bucket?: string;
    storage_region?: string;
    storage_base_url?: string;
    branding_app_name?: string;
    branding_logo_url?: string;
    feature_inventory?: boolean;
    feature_billing?: boolean;
    feature_reports?: boolean;
    feature_hr?: boolean;
    feature_promotions?: boolean;
    global_tax_default?: number;
    currency_default?: string;
    timezone_default?: string;
  }) {
    if (input.default_plan_id) {
      const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: input.default_plan_id } });
      if (!plan) throw new NotFoundException("Default plan not found");
    }
    const pairs: Array<[string, Prisma.InputJsonValue]> = [];
    if (input.system_name !== undefined) pairs.push(["system_name", input.system_name]);
    if (input.support_email !== undefined) pairs.push(["support_email", input.support_email]);
    if (input.maintenance_mode !== undefined) pairs.push(["maintenance_mode", input.maintenance_mode]);
    if (input.default_trial_days !== undefined) pairs.push(["default_trial_days", input.default_trial_days]);
    if (input.default_plan_id !== undefined) pairs.push(["default_plan_id", input.default_plan_id]);
    if (input.smtp_host !== undefined) pairs.push(["smtp_host", input.smtp_host]);
    if (input.smtp_port !== undefined) pairs.push(["smtp_port", input.smtp_port]);
    if (input.smtp_user !== undefined) pairs.push(["smtp_user", input.smtp_user]);
    if (input.smtp_password !== undefined) pairs.push(["smtp_password", input.smtp_password]);
    if (input.smtp_from_email !== undefined) pairs.push(["smtp_from_email", input.smtp_from_email]);
    if (input.smtp_from_name !== undefined) pairs.push(["smtp_from_name", input.smtp_from_name]);
    if (input.storage_driver !== undefined) pairs.push(["storage_driver", input.storage_driver]);
    if (input.storage_bucket !== undefined) pairs.push(["storage_bucket", input.storage_bucket]);
    if (input.storage_region !== undefined) pairs.push(["storage_region", input.storage_region]);
    if (input.storage_base_url !== undefined) pairs.push(["storage_base_url", input.storage_base_url]);
    if (input.branding_app_name !== undefined) pairs.push(["branding_app_name", input.branding_app_name]);
    if (input.branding_logo_url !== undefined) pairs.push(["branding_logo_url", input.branding_logo_url]);
    if (input.feature_inventory !== undefined) pairs.push(["feature_inventory", input.feature_inventory]);
    if (input.feature_billing !== undefined) pairs.push(["feature_billing", input.feature_billing]);
    if (input.feature_reports !== undefined) pairs.push(["feature_reports", input.feature_reports]);
    if (input.feature_hr !== undefined) pairs.push(["feature_hr", input.feature_hr]);
    if (input.feature_promotions !== undefined) pairs.push(["feature_promotions", input.feature_promotions]);
    if (input.global_tax_default !== undefined) pairs.push(["global_tax_default", input.global_tax_default]);
    if (input.currency_default !== undefined) pairs.push(["currency_default", input.currency_default]);
    if (input.timezone_default !== undefined) pairs.push(["timezone_default", input.timezone_default]);
    for (const [key, value] of pairs) {
      await this.prisma.platformSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value }
      });
    }
    return this.settings();
  }

  async ensureBootstrapOwner() {
    const any = await this.prisma.superAdminUser.count();
    if (any > 0) return;
    const email = (process.env.SUPER_ADMIN_EMAIL || "owner@postrend.local").trim().toLowerCase();
    await this.prisma.superAdminUser.create({
      data: {
        email,
        fullName: "Platform Owner",
        passwordHash: this.hashSecret(process.env.SUPER_ADMIN_PASSWORD || "Owner123!"),
        status: "active"
      }
    });
  }

  async assertTenantAccessAllowed(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, suspensionReason: true }
    });
    if (!tenant) throw new UnauthorizedException("Tenant not found");
    if (tenant.status === "suspended") {
      throw new UnauthorizedException(
        `Tenant suspended${tenant.suspensionReason ? `: ${tenant.suspensionReason}` : ""}`
      );
    }
    if (tenant.status === "cancelled") {
      throw new UnauthorizedException("Tenant cancelled");
    }
  }

  private async audit(
    tenantId: string,
    action: string,
    actorId?: string,
    reason?: string,
    metadata?: Record<string, unknown>
  ) {
    await this.prisma.superAdminAuditLog.create({
      data: {
        tenantId,
        action,
        actorId: actorId || null,
        reason: reason || null,
        metadata: (metadata || {}) as Prisma.InputJsonValue
      }
    });
  }

  private hashSecret(secret: string) {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(secret, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  private verifySecret(secret: string, stored: string) {
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;
    const hashBuffer = scryptSync(secret, salt, 64);
    const keyBuffer = Buffer.from(key, "hex");
    return hashBuffer.length === keyBuffer.length && timingSafeEqual(hashBuffer, keyBuffer);
  }

  private slugify(input: string) {
    return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `post-${Date.now()}`;
  }

  private async ensureUniqueBlogSlug(base: string, excludeId?: string) {
    let slug = base;
    let i = 1;
    while (true) {
      const existing = await this.prisma.blogPost.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {})
        },
        select: { id: true }
      });
      if (!existing) return slug;
      slug = `${base}-${i++}`;
    }
  }

  private async syncBlogPostTaxonomy(postId: string, categories: string[], tags: string[]) {
    await this.prisma.blogPostCategory.deleteMany({ where: { postId } });
    await this.prisma.blogPostTag.deleteMany({ where: { postId } });
    for (const raw of categories.map((x) => x.trim()).filter(Boolean)) {
      const slug = this.slugify(raw);
      const c = await this.prisma.blogCategory.upsert({
        where: { slug },
        create: { name: raw, slug },
        update: { name: raw }
      });
      await this.prisma.blogPostCategory.create({ data: { postId, categoryId: c.id } });
    }
    for (const raw of tags.map((x) => x.trim()).filter(Boolean)) {
      const slug = this.slugify(raw);
      const t = await this.prisma.blogTag.upsert({
        where: { slug },
        create: { name: raw, slug },
        update: { name: raw }
      });
      await this.prisma.blogPostTag.create({ data: { postId, tagId: t.id } });
    }
  }
}

