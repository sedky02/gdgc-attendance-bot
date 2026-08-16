import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "../../auth/jwt-payload.js";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user as JwtPayload;
});
