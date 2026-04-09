import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { TenantContext } from "../types/tenant-context.type";

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as TenantContext | undefined;
    if (!user?.tenant_id || !user?.concept_id || !user?.branch_id) {
      throw new UnauthorizedException("Missing tenant context");
    }
    return user;
  }
);
