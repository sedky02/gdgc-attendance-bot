import type { SecuritySchemeObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";

/**
 * The two ways a caller authenticates, per README's architecture: the bot
 * with a static header token (unrestricted across guilds), the dashboard with
 * a per-user JWT (scoped to the one guild it was minted for).
 *
 * Listing both on a route means "either one works" — OpenAPI treats multiple
 * entries in an operation's `security` array as alternatives, which is exactly
 * what ServiceOrJwtGuard does.
 */
export const SERVICE_TOKEN_SCHEME = "service-token";
export const DASHBOARD_JWT_SCHEME = "dashboard-jwt";

export const SERVICE_TOKEN_SECURITY: SecuritySchemeObject = {
  type: "apiKey",
  in: "header",
  name: "X-Service-Token",
  description: "Static token shared by the bot and the API (`BOT_SERVICE_TOKEN`).",
};

export const DASHBOARD_JWT_SECURITY: SecuritySchemeObject = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Guild-scoped JWT minted by the dashboard after verifying Discord guild membership.",
};
