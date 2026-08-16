import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "../../auth/jwt-payload.js";

/**
 * Runs after JwtGuard. Confirms the guild the request targets (route param,
 * query, or body) matches the guild the caller authenticated into — a JWT
 * minted for one guild must not read or write another guild's data.
 */
@Injectable()
export class GuildRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      throw new ForbiddenException("Missing authenticated user");
    }

    const targetGuildId =
      (request.params?.guildId as string | undefined) ??
      (request.query?.guildId as string | undefined) ??
      (request.body as Record<string, unknown> | undefined)?.guildId;

    if (targetGuildId && targetGuildId !== user.guildId) {
      throw new ForbiddenException("Guild mismatch");
    }
    return true;
  }
}
