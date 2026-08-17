import { UseGuards, applyDecorators } from "@nestjs/common";
import { ApiSecurity, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { ServiceTokenGuard } from "../guards/service-token.guard.js";
import { SERVICE_TOKEN_SCHEME } from "../../openapi/security-schemes.js";

/**
 * Bot-only. The guard and the documented security scheme are applied
 * together so a route can't acquire one without the other.
 */
export const ServiceOnly = () =>
  applyDecorators(
    UseGuards(ServiceTokenGuard),
    ApiSecurity(SERVICE_TOKEN_SCHEME),
    ApiUnauthorizedResponse({ description: "Missing or invalid X-Service-Token" }),
  );
