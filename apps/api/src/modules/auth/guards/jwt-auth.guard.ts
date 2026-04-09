import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { TokenExpiredError } from "jsonwebtoken";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = (request.path as string) || "";
    if (
      path.startsWith("/v1/auth") ||
      path.startsWith("/v1/super-admin/auth/login") ||
      path.startsWith("/v1/health") ||
      path.startsWith("/v1/public") ||
      path.startsWith("/v1/pos/device-login") ||
      path.startsWith("/v1/pos/device-refresh")
    ) {
      return true;
    }

    const authHeader = request.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeader.replace("Bearer ", "");
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || "dev-secret"
      });
      if (path.startsWith("/v1/super-admin") && payload.role !== "super_admin") {
        throw new UnauthorizedException("Super admin token required");
      }
      request.user = payload;
      return true;
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new UnauthorizedException("Access token expired");
      }
      throw new UnauthorizedException("Invalid token");
    }
  }
}
