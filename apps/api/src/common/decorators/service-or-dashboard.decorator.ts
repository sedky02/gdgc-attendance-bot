import { UseGuards, applyDecorators } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiSecurity, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { ServiceOrJwtGuard } from "../guards/service-or-jwt.guard.js";
import { DASHBOARD_JWT_SCHEME, SERVICE_TOKEN_SCHEME } from "../../openapi/security-schemes.js";

/**
 * Either client. Both schemes are listed, which OpenAPI reads as "any one of
 * these is sufficient" — matching ServiceOrJwtGuard, which tries the service
 * token first and falls back to verifying the dashboard's guild-scoped JWT.
 */
export const ServiceOrDashboard = () =>
  applyDecorators(
    UseGuards(ServiceOrJwtGuard),
    ApiSecurity(SERVICE_TOKEN_SCHEME),
    ApiBearerAuth(DASHBOARD_JWT_SCHEME),
    ApiUnauthorizedResponse({ description: "Missing service token and missing or invalid bearer token" }),
    ApiForbiddenResponse({ description: "Bearer token was minted for a different guild" }),
  );
