import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { Env } from "../../config/env.validation.js";

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.header("X-Service-Token");
    const expected = this.configService.get("BOT_SERVICE_TOKEN", { infer: true });

    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid or missing service token");
    }
    return true;
  }
}
