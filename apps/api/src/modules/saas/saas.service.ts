import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { JwtService } from "@nestjs/jwt";
import nodemailer from "nodemailer";
import { PrismaService } from "../database/prisma.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import { CreateBranchDto, CreateConceptDto, CreateUserDto, DemoRequestDto, LeadCaptureDto, NewsletterSignupDto, RegisterDeviceDto, SignupDto, UpdateUserDto } from "./dto/signup.dto";

@Injectable()
export class SaasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });
  }

  async signup(dto: SignupDto) {
    const timezone = this.resolveTimezone(dto.country);
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: "starter", isActive: true }
    });
    if (!plan) {
      throw new ForbiddenException("No active starter plan configured");
    }

    const slug = dto.tenant_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const passwordHash = this.hashSecret(dto.password);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenant_name,
          slug: `${slug}-${randomUUID().slice(0, 6)}`,
          status: "trial",
          plan: plan.code,
          planId: plan.id,
          trialStartsAt: now,
          trialEndsAt
        }
      });

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: "trialing",
          startsAt: now,
          trialEndsAt
        }
      });

      const concept = await tx.concept.create({
        data: {
          tenantId: tenant.id,
          name: "Default Concept",
          isDefault: true
        }
      });

      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          conceptId: concept.id,
          name: "Main Branch",
          timezone,
          currency: dto.currency.toUpperCase(),
          isDefault: true
        }
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          conceptId: concept.id,
          branchId: branch.id,
          email: dto.email,
          passwordHash,
          fullName: dto.owner_name,
          status: "active"
        }
      });

      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          code: "tenant_owner",
          name: "Tenant Owner",
          scope: "tenant"
        }
      });

      await tx.userRoleAssignment.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: role.id
        }
      });

      const defaultDepartment =
        (await tx.department.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "asc" }
        })) ||
        (await tx.department.create({
          data: { tenantId: tenant.id, name: "General", description: "Default department" }
        }));

      await tx.employee.create({
        data: {
          tenantId: tenant.id,
          conceptId: concept.id,
          branchId: branch.id,
          fullName: dto.owner_name,
          roleId: role.id,
          departmentId: defaultDepartment.id,
          employmentType: "full_time",
          status: "active",
          dateJoined: now
        }
      });

      return { tenant, concept, branch, user, role };
    });

    return this.issueUserTokens({
      userId: result.user.id,
      role: result.role.code,
      tenantId: result.tenant.id,
      conceptId: result.concept.id,
      branchId: result.branch.id
    });
  }

  async createDemoRequest(dto: DemoRequestDto) {
    const lead = await this.prisma.demoLead.create({
      data: {
        name: dto.name,
        company: dto.company,
        email: dto.email,
        phone: dto.phone,
        country: dto.country,
        businessType: dto.business_type
      }
    });
    const emailSent = await this.sendDemoRequestEmail({ ...dto, id: lead.id });
    return { id: lead.id, status: "received", email_sent: emailSent };
  }

  async captureLead(dto: LeadCaptureDto) {
    const lead = await this.prisma.demoLead.create({
      data: {
        name: dto.name,
        company: dto.company || "Website Lead",
        email: dto.email,
        phone: dto.phone || "-",
        country: "Unknown",
        businessType: "lead_capture"
      }
    });
    return { id: lead.id, status: "captured" };
  }

  async newsletterSignup(dto: NewsletterSignupDto) {
    const row = await this.prisma.newsletterSubscriber.upsert({
      where: { email: dto.email.toLowerCase() },
      create: { email: dto.email.toLowerCase(), source: dto.source || "website" },
      update: { source: dto.source || "website" }
    });
    return { id: row.id, status: "subscribed" };
  }

  async listPublicBlogPosts(filters: { category?: string; tag?: string; q?: string }) {
    const rows = await this.prisma.blogPost.findMany({
      where: {
        status: "published",
        ...(filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: "insensitive" } },
                { excerpt: { contains: filters.q, mode: "insensitive" } },
                { content: { contains: filters.q, mode: "insensitive" } }
              ]
            }
          : {}),
        ...(filters.category
          ? {
              categories: {
                some: { category: { slug: filters.category.toLowerCase() } }
              }
            }
          : {}),
        ...(filters.tag
          ? {
              tags: {
                some: { tag: { slug: filters.tag.toLowerCase() } }
              }
            }
          : {})
      },
      include: {
        categories: { include: { category: true } },
        tags: { include: { tag: true } }
      },
      orderBy: { publishedAt: "desc" }
    });
    const categories = await this.prisma.blogCategory.findMany({ orderBy: { name: "asc" } });
    const tags = await this.prisma.blogTag.findMany({ orderBy: { name: "asc" } });
    return {
      data: rows.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        seo_title: p.seoTitle,
        seo_description: p.seoDescription,
        og_image: p.ogImage,
        author_name: p.authorName,
        author_email: p.authorEmail,
        published_at: p.publishedAt,
        categories: p.categories.map((c) => c.category.name),
        tags: p.tags.map((t) => t.tag.name)
      })),
      categories: categories.map((c) => ({ name: c.name, slug: c.slug })),
      tags: tags.map((t) => ({ name: t.name, slug: t.slug }))
    };
  }

  async getPublicBlogPost(slug: string) {
    const p = await this.prisma.blogPost.findFirst({
      where: { slug, status: "published" },
      include: {
        categories: { include: { category: true } },
        tags: { include: { tag: true } }
      }
    });
    if (!p) throw new ForbiddenException("Post not found");
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
      seo_title: p.seoTitle,
      seo_description: p.seoDescription,
      og_image: p.ogImage,
      author_name: p.authorName,
      author_email: p.authorEmail,
      published_at: p.publishedAt,
      categories: p.categories.map((c) => c.category.name),
      tags: p.tags.map((t) => t.tag.name)
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } }
    });
    if (!user || !user.passwordHash || !this.verifySecret(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid credentials");
    }
    await this.assertTenantAccessAllowed(user.tenantId);

    const assignment = await this.prisma.userRoleAssignment.findFirst({
      where: { userId: user.id },
      include: { role: true }
    });
    const role = assignment?.role.code || "admin";
    const conceptId = user.conceptId || assignment?.conceptId || "";
    const branchId = user.branchId || assignment?.branchId || "";

    return this.issueUserTokens({
      userId: user.id,
      role,
      tenantId: user.tenantId,
      conceptId,
      branchId
    });
  }

  async cashierLoginForDevice(ctx: TenantContext, email: string, password: string) {
    if (!ctx.sub?.startsWith("device:")) {
      throw new UnauthorizedException("Device token required");
    }
    const deviceId = ctx.sub.slice("device:".length);
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } }
    });
    if (!user || !user.passwordHash || !this.verifySecret(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (user.tenantId !== ctx.tenant_id) {
      throw new UnauthorizedException("User does not belong to this tenant");
    }
    if (user.status !== "active") {
      throw new UnauthorizedException("User is not active");
    }
    await this.assertTenantAccessAllowed(user.tenantId);

    const assignment = await this.prisma.userRoleAssignment.findFirst({
      where: { userId: user.id },
      include: { role: true }
    });
    const role = assignment?.role.code || "admin";
    const conceptId = user.conceptId || assignment?.conceptId || ctx.concept_id || "";
    const branchId = user.branchId || assignment?.branchId || ctx.branch_id || "";

    await this.prisma.$transaction(async (tx) => {
      await tx.posCashierSession.updateMany({
        where: { deviceId, status: "ACTIVE" },
        data: { status: "ENDED", endedAt: new Date() }
      });
      await tx.posCashierSession.create({
        data: {
          tenantId: ctx.tenant_id,
          branchId: ctx.branch_id,
          conceptId: ctx.concept_id,
          deviceId,
          cashierUserId: user.id,
          status: "ACTIVE",
          startedAt: new Date()
        }
      });
    });

    return this.issueUserTokens({
      userId: user.id,
      role,
      tenantId: user.tenantId,
      conceptId,
      branchId
    });
  }

  async cashierLogoutForDevice(ctx: TenantContext) {
    if (!ctx.sub?.startsWith("device:")) {
      throw new UnauthorizedException("Device token required");
    }
    const deviceId = ctx.sub.slice("device:".length);
    await this.prisma.posCashierSession.updateMany({
      where: { deviceId, status: "ACTIVE" },
      data: { status: "ENDED", endedAt: new Date() }
    });
    return { ok: true };
  }

  async tenantMe(ctx: TenantContext) {
    return this.prisma.tenant.findUnique({
      where: { id: ctx.tenant_id }
    });
  }

  async subscription(ctx: TenantContext) {
    return this.prisma.tenantSubscription.findFirst({
      where: { tenantId: ctx.tenant_id },
      orderBy: { startsAt: "desc" },
      include: { plan: true }
    });
  }

  async limits(ctx: TenantContext) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: ctx.tenant_id },
      include: { plans: true }
    });
    const plan = tenant?.plans;
    return {
      plan: plan?.code || tenant?.plan || "starter",
      max_concepts: plan?.maxConcepts || 1,
      max_branches: plan?.maxBranches || 1,
      max_devices: plan?.maxDevices || 3,
      max_users: plan?.maxUsers || 5
    };
  }

  async createConcept(ctx: TenantContext, dto: CreateConceptDto) {
    await this.enforceLimit(ctx.tenant_id, "concepts");
    return this.prisma.concept.create({
      data: {
        tenantId: ctx.tenant_id,
        name: dto.name
      }
    });
  }

  async listConcepts(ctx: TenantContext) {
    return this.prisma.concept.findMany({
      where: { tenantId: ctx.tenant_id },
      orderBy: { createdAt: "asc" }
    });
  }

  async createBranch(ctx: TenantContext, dto: CreateBranchDto) {
    await this.enforceLimit(ctx.tenant_id, "branches");
    return this.prisma.branch.create({
      data: {
        tenantId: ctx.tenant_id,
        conceptId: dto.concept_id,
        name: dto.name,
        timezone: dto.timezone,
        currency: dto.currency
      }
    });
  }

  async listBranches(ctx: TenantContext) {
    return this.prisma.branch.findMany({
      where: { tenantId: ctx.tenant_id },
      orderBy: { createdAt: "asc" }
    });
  }

  async registerDevice(ctx: TenantContext, dto: RegisterDeviceDto) {
    await this.enforceLimit(ctx.tenant_id, "devices");
    const secret = randomBytes(16).toString("hex");
    const deviceCode = `POS-${randomBytes(3).toString("hex").toUpperCase()}`;
    const device = await this.prisma.device.create({
      data: {
        tenantId: ctx.tenant_id,
        conceptId: dto.concept_id,
        branchId: dto.branch_id,
        deviceName: dto.device_name,
        deviceCode,
        deviceSecretHash: this.hashSecret(secret),
        status: "active"
      }
    });
    return {
      id: device.id,
      device_code: device.deviceCode,
      device_secret: secret,
      branch_id: device.branchId,
      status: device.status
    };
  }

  async listDevices(ctx: TenantContext) {
    return this.prisma.device.findMany({
      where: { tenantId: ctx.tenant_id },
      orderBy: { createdAt: "asc" }
    });
  }

  async listUsers(ctx: TenantContext) {
    const rows = await this.prisma.user.findMany({
      where: { tenantId: ctx.tenant_id },
      include: {
        roleAssignments: { include: { role: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      status: u.status,
      role: u.roleAssignments[0]?.role?.name || "Unassigned",
      branchId: u.branchId,
      conceptId: u.conceptId
    }));
  }

  async createUser(ctx: TenantContext, dto: CreateUserDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const exists = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } }
    });
    if (exists) throw new ForbiddenException("Email already exists");

    const role = await this.prisma.role.findFirst({
      where: { id: dto.role_id, tenantId: ctx.tenant_id }
    });
    if (!role) throw new ForbiddenException("Role not found");

    const branchId = dto.branch_id || ctx.branch_id;
    const conceptId = ctx.concept_id;
    const passwordHash = this.hashSecret(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: ctx.tenant_id,
          conceptId,
          branchId,
          email: normalizedEmail,
          passwordHash,
          fullName: dto.full_name,
          status: "active"
        }
      });
      await tx.userRoleAssignment.create({
        data: {
          tenantId: ctx.tenant_id,
          userId: user.id,
          roleId: role.id,
          conceptId,
          branchId
        }
      });

      const departmentId =
        dto.department_id ||
        (
          await tx.department.findFirst({
            where: { tenantId: ctx.tenant_id },
            orderBy: { createdAt: "asc" }
          })
        )?.id ||
        (
          await tx.department.create({
            data: { tenantId: ctx.tenant_id, name: "General", description: "Default department" }
          })
        ).id;

      await tx.employee.create({
        data: {
          tenantId: ctx.tenant_id,
          conceptId,
          branchId,
          fullName: dto.full_name,
          roleId: role.id,
          departmentId,
          employmentType: "full_time",
          status: "active",
          dateJoined: new Date()
        }
      });

      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: role.name,
        branchId
      };
    });
  }

  async updateUser(ctx: TenantContext, userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: ctx.tenant_id }
    });
    if (!user) throw new ForbiddenException("User not found");

    const normalizedEmail = dto.email ? this.normalizeEmail(dto.email) : undefined;
    if (normalizedEmail && normalizedEmail.toLowerCase() !== user.email.toLowerCase()) {
      const emailExists = await this.prisma.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: "insensitive" },
          id: { not: user.id }
        }
      });
      if (emailExists) throw new ForbiddenException("Email already exists");
    }

    const nextRoleId = dto.role_id;
    if (nextRoleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: nextRoleId, tenantId: ctx.tenant_id }
      });
      if (!role) throw new ForbiddenException("Role not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          fullName: dto.full_name ?? user.fullName,
          email: normalizedEmail ?? user.email,
          passwordHash: dto.password ? this.hashSecret(dto.password) : user.passwordHash,
          branchId: dto.branch_id ?? user.branchId,
          status: dto.status ?? user.status
        }
      });

      if (nextRoleId) {
        await tx.userRoleAssignment.updateMany({
          where: { userId: user.id, tenantId: ctx.tenant_id },
          data: { roleId: nextRoleId, branchId: dto.branch_id ?? user.branchId }
        });
      }

      // Best-effort sync until user<->employee direct FK is introduced.
      const employeeData: {
        fullName?: string;
        roleId?: string;
        departmentId?: string;
        status?: string;
      } = {
        fullName: dto.full_name ?? user.fullName
      };
      if (nextRoleId) employeeData.roleId = nextRoleId;
      if (dto.department_id) employeeData.departmentId = dto.department_id;
      if (dto.status) employeeData.status = dto.status;

      await tx.employee.updateMany({
        where: {
          tenantId: ctx.tenant_id,
          conceptId: user.conceptId || ctx.concept_id,
          branchId: dto.branch_id ?? (user.branchId || ctx.branch_id),
          fullName: user.fullName
        },
        data: employeeData
      });

      const assignment = await tx.userRoleAssignment.findFirst({
        where: { userId: updated.id },
        include: { role: true }
      });
      return {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        status: updated.status,
        role: assignment?.role?.name || "Unassigned",
        branchId: updated.branchId
      };
    });
  }

  async deactivateUser(ctx: TenantContext, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: ctx.tenant_id }
    });
    if (!user) throw new ForbiddenException("User not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { status: "inactive" }
      });
      await tx.employee.updateMany({
        where: {
          tenantId: ctx.tenant_id,
          conceptId: user.conceptId || ctx.concept_id,
          branchId: user.branchId || ctx.branch_id,
          fullName: user.fullName
        },
        data: { status: "inactive", dateLeft: new Date() }
      });
    });
    return { id: user.id, status: "inactive" };
  }

  async setDeviceStatus(ctx: TenantContext, deviceId: string, status: "blocked" | "active") {
    const updated = await this.prisma.device.updateMany({
      where: { id: deviceId, tenantId: ctx.tenant_id },
      data: { status }
    });
    if (updated.count === 0) {
      throw new ForbiddenException("Device not found");
    }
    return { id: deviceId, status };
  }

  /** Issues a new plaintext secret (invalidates the previous one). Use when the original was lost. */
  async rotateDeviceSecret(ctx: TenantContext, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId: ctx.tenant_id }
    });
    if (!device) {
      throw new ForbiddenException("Device not found");
    }
    const secret = randomBytes(16).toString("hex");
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { deviceSecretHash: this.hashSecret(secret) }
    });
    return {
      device_code: device.deviceCode,
      device_secret: secret
    };
  }

  async listRolePermissions(ctx: TenantContext) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId: ctx.tenant_id },
      include: { permissions: true },
      orderBy: { name: "asc" }
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions.map((p) => p.permissionKey)
    }));
  }

  async updateRolePermissions(ctx: TenantContext, roleId: string, permissionKeys: string[]) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId: ctx.tenant_id }
    });
    if (!role) throw new ForbiddenException("Role not found");

    const uniqueKeys = Array.from(new Set(permissionKeys.filter(Boolean)));
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (uniqueKeys.length > 0) {
        await tx.rolePermission.createMany({
          data: uniqueKeys.map((key) => ({ roleId, permissionKey: key }))
        });
      }
    });

    return { role_id: roleId, permission_keys: uniqueKeys };
  }

  async deviceLogin(deviceCode: string, deviceSecret: string, clientDeviceName?: string) {
    const device = await this.prisma.device.findUnique({
      where: { deviceCode },
      include: { branch: true }
    });
    if (!device || !device.deviceSecretHash || device.status !== "active") {
      throw new UnauthorizedException("Invalid device credentials");
    }
    if (!this.verifySecret(deviceSecret, device.deviceSecretHash)) {
      throw new UnauthorizedException("Invalid device credentials");
    }
    await this.assertTenantAccessAllowed(device.tenantId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: device.tenantId }
    });
    if (!tenant) {
      throw new UnauthorizedException("Invalid device credentials");
    }

    const nameUpdate =
      clientDeviceName !== undefined && clientDeviceName.trim().length > 0
        ? { deviceName: clientDeviceName.trim() }
        : {};

    await this.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date(), ...nameUpdate }
    });

    const accessJti = randomUUID();
    const refreshJti = randomUUID();
    await this.prisma.deviceSession.create({
      data: {
        tenantId: device.tenantId,
        deviceId: device.id,
        accessTokenJti: accessJti,
        refreshTokenJti: refreshJti,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    const payload = {
      sub: `device:${device.id}`,
      role: "pos_device",
      tenant_id: device.tenantId,
      concept_id: device.conceptId,
      branch_id: device.branchId
    };
    const access_token = this.jwtService.sign({ ...payload, jti: accessJti });
    const refresh_token = this.jwtService.sign({ ...payload, jti: refreshJti }, { expiresIn: "7d" });
    return {
      token: access_token,
      access_token,
      refresh_token,
      token_type: "Bearer",
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status
      },
      branch: {
        id: device.branch.id,
        name: device.branch.name,
        currency: device.branch.currency,
        timezone: device.branch.timezone
      }
    };
  }

  private async enforceLimit(tenantId: string, type: "concepts" | "branches" | "devices") {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plans: true }
    });
    if (!tenant) {
      throw new ForbiddenException("Tenant not found");
    }
    const plan = tenant.plans;
    if (!plan) {
      return;
    }

    if (type === "concepts") {
      const current = await this.prisma.concept.count({ where: { tenantId } });
      if (current >= plan.maxConcepts) {
        throw new ForbiddenException(
          JSON.stringify({ limit_type: "concepts", current_usage: current, max_allowed: plan.maxConcepts })
        );
      }
    }
    if (type === "branches") {
      const current = await this.prisma.branch.count({ where: { tenantId } });
      if (current >= plan.maxBranches) {
        throw new ForbiddenException(
          JSON.stringify({ limit_type: "branches", current_usage: current, max_allowed: plan.maxBranches })
        );
      }
    }
    if (type === "devices") {
      const current = await this.prisma.device.count({
        where: { tenantId, status: "active" }
      });
      if (current >= plan.maxDevices) {
        throw new ForbiddenException(
          JSON.stringify({ limit_type: "devices", current_usage: current, max_allowed: plan.maxDevices })
        );
      }
    }
  }

  private async assertTenantAccessAllowed(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true, suspensionReason: true }
    });
    if (!tenant) throw new UnauthorizedException("Tenant not found");
    if (tenant.status === "suspended") {
      throw new UnauthorizedException(
        `Tenant suspended${tenant.suspensionReason ? `: ${tenant.suspensionReason}` : ""}`
      );
    }
    if (tenant.status === "cancelled") throw new UnauthorizedException("Tenant cancelled");
  }

  private issueUserTokens(params: {
    userId: string;
    role: string;
    tenantId: string;
    conceptId: string;
    branchId: string;
  }) {
    const payload = {
      sub: params.userId,
      role: params.role,
      tenant_id: params.tenantId,
      concept_id: params.conceptId,
      branch_id: params.branchId
    };
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: "7d" }),
      token_type: "Bearer"
    };
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

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private resolveTimezone(country: string) {
    const c = country.trim().toLowerCase();
    if (c.includes("lebanon")) return "Asia/Beirut";
    if (c.includes("saudi")) return "Asia/Riyadh";
    if (c.includes("uae") || c.includes("united arab emirates")) return "Asia/Dubai";
    if (c.includes("uk") || c.includes("united kingdom")) return "Europe/London";
    if (c.includes("france")) return "Europe/Paris";
    if (c.includes("usa") || c.includes("united states")) return "America/New_York";
    return "UTC";
  }

  private async sendDemoRequestEmail(input: DemoRequestDto & { id: string }) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASSWORD || "";
    const to = process.env.DEMO_LEAD_EMAIL_TO || process.env.SMTP_FROM_EMAIL || "support@postrend.local";
    const from = process.env.SMTP_FROM_EMAIL || "no-reply@postrend.local";
    const subject = `New demo request: ${input.company}`;
    const text = [
      `Lead ID: ${input.id}`,
      `Name: ${input.name}`,
      `Company: ${input.company}`,
      `Email: ${input.email}`,
      `Phone: ${input.phone}`,
      `Country: ${input.country}`,
      `Business type: ${input.business_type}`
    ].join("\n");

    try {
      const transporter = host
        ? nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: user ? { user, pass } : undefined
          })
        : nodemailer.createTransport({ jsonTransport: true });
      await transporter.sendMail({ from, to, subject, text });
      return true;
    } catch {
      return false;
    }
  }
}
