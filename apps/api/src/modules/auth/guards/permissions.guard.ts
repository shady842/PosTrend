import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

const FULL_ACCESS_ROLES = new Set(["super_admin", "tenant_owner", "branch_manager", "admin"]);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { role?: string; tenant_id?: string }
      | undefined;
    const role = user?.role;
    const tenantId = user?.tenant_id;
    if (!role || !tenantId) {
      throw new ForbiddenException("Missing tenant context");
    }

    if (FULL_ACCESS_ROLES.has(role)) return true;

    const roleRecord = await this.prisma.role.findFirst({
      where: { tenantId, code: role },
      include: { permissions: true }
    });
    const granted = new Set(
      (roleRecord?.permissions ?? []).map((p) => p.permissionKey)
    );
    const missing = required.filter((k) => !granted.has(k));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required permission(s): ${missing.join(", ")}`
      );
    }
    return true;
  }
}
