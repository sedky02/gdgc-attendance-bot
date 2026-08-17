import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";
import { buildContractSchemas } from "./contract-schemas.js";
import {
  DASHBOARD_JWT_SCHEME,
  DASHBOARD_JWT_SECURITY,
  SERVICE_TOKEN_SCHEME,
  SERVICE_TOKEN_SECURITY,
} from "./security-schemes.js";

/** Served outside the `api/v1` prefix, alongside `/health`. */
export const SWAGGER_UI_PATH = "docs";
export const SWAGGER_JSON_PATH = "docs/openapi.json";

const DESCRIPTION = [
  "REST API behind the Discord meeting bot and the web dashboard.",
  "",
  "Every route is scoped to a guild. The bot authenticates with a static `X-Service-Token`;",
  "the dashboard authenticates with a guild-scoped bearer JWT. Routes that accept either will",
  "list both schemes — any one of them is sufficient.",
  "",
  "Mutations that depend on observed Discord voice state (`start`, `pause`, `resume`, `end`,",
  "`cancel`, `sync`) are bot-only: they carry an `observedAt` supplied by the observer, never",
  "generated server-side, so a retried request cannot shift the record.",
].join("\n");

/**
 * Builds the OpenAPI document from route metadata, then grafts on
 * `components.schemas` generated from the Zod contracts. Nest's own
 * reflection can't see Zod schemas — they're values, not decorated classes —
 * so the two halves are assembled here rather than inferred.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Meeting System API")
    .setDescription(DESCRIPTION)
    .setVersion("1.0")
    .addApiKey(SERVICE_TOKEN_SECURITY, SERVICE_TOKEN_SCHEME)
    .addBearerAuth(DASHBOARD_JWT_SECURITY, DASHBOARD_JWT_SCHEME)
    .addTag("health", "Liveness and connectivity")
    .addTag("meeting-types", "Reusable meeting configuration and its expected roles")
    .addTag("meetings", "The meeting lifecycle state machine")
    .addTag("attendance", "Presence reconciliation and manual correction")
    .addTag("reports", "Assembled meeting + attendance + absentees")
    .addTag("internal", "Endpoints only the bot calls")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      ...(buildContractSchemas() as Record<string, SchemaObject>),
    },
  };

  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    swaggerOptions: { persistAuthorization: true, tagsSorter: "alpha" },
  });
}
