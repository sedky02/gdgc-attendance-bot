import { z } from "zod";

// `z.coerce.boolean()` runs plain `Boolean(value)`, so the string "false"
// coerces to `true`. Parse the two accepted literals explicitly instead.
const envBoolean = z.enum(["true", "false"]).transform((value) => value === "true");

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    BOT_SERVICE_TOKEN: z.string().min(32),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    CORS_ORIGIN: z.string().min(1),
    // The Swagger UI enumerates every route and its auth scheme, so it's off
    // by default in production. Set it explicitly to override either way.
    SWAGGER_ENABLED: envBoolean.optional(),
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== "production",
  }));
export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${result.error.toString()}`);
  }
  return result.data;
}
