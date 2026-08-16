import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Env } from "../../config/env.validation.js";
import type { JwtPayload } from "../../auth/jwt-payload.js";
import { GuildOwnershipService } from "../guild-ownership.service.js";
import { RESOURCE_TYPE_KEY, type ResourceTypeValue } from "../decorators/resource-type.decorator.js";

/**
 * Both clients hit the same endpoints (README's architecture): the bot with
 * a static X-Service-Token, unrestricted across guilds; the dashboard with a
 * per-user JWT, scoped to the one guild it was minted for. This guard tries
 * the service token first, then falls back to verifying the JWT and
 * enforcing that guild scope.
 *
 * Most routes carry a guildId directly (query/body/param) and that's checked
 * first. Routes scoped by a resource id instead (`/meetings/:id/...`,
 * `/attendance/:id`, `/meeting-types/:id`) carry no guildId at all, so a JWT
 * minted for one guild could otherwise read or write another guild's data by
 * id — GuildOwnershipService resolves the owning guild for that id (per
 * ResourceType) and this guard checks it the same way.
 */
@Injectable()
export class ServiceOrJwtGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService<Env, true>,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(GuildOwnershipService) private readonly guildOwnershipService: GuildOwnershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const serviceToken = request.header("X-Service-Token");
    if (serviceToken && serviceToken === this.configService.get("BOT_SERVICE_TOKEN", { infer: true })) {
      return true;
    }

    const authHeader = request.header("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
    if (!bearerToken) {
      throw new UnauthorizedException("Missing service token or bearer token");
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(bearerToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired bearer token");
    }

    request.user = payload;

    const directGuildId =
      (request.params?.guildId as string | undefined) ??
      (request.query?.guildId as string | undefined) ??
      (request.body as Record<string, unknown> | undefined)?.guildId;

    if (directGuildId) {
      if (directGuildId !== payload.guildId) {
        throw new ForbiddenException("Guild mismatch");
      }
      return true;
    }

    const id = request.params?.id;
    if (!id) {
      return true;
    }

    const resourceType =
      this.reflector.getAllAndOverride<ResourceTypeValue>(RESOURCE_TYPE_KEY, [context.getHandler(), context.getClass()]) ??
      "meeting";
    const ownerGuildId = await this.guildOwnershipService.resolveOwnerGuildId(resourceType, id);

    // If the resource doesn't exist, let the controller's own NotFoundException
    // fire naturally rather than masking it as a 403 here.
    if (ownerGuildId && ownerGuildId !== payload.guildId) {
      throw new ForbiddenException("Guild mismatch");
    }

    return true;
  }
}
