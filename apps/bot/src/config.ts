import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APPLICATION_ID: z.string().min(1),
  DISCORD_DEV_GUILD_ID: z.string().optional(),
  API_BASE_URL: z.string().url(),
  BOT_SERVICE_TOKEN: z.string().min(1),
  RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  // Render injects this automatically for a "Web Service" and expects the
  // process to listen on it — see health-server.ts. Unused for hosts (or
  // local dev) that don't need a keep-alive ping target.
  PORT: z.coerce.number().int().positive().default(3002),
});

export const env = EnvSchema.parse(process.env);
