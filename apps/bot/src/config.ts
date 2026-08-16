import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APPLICATION_ID: z.string().min(1),
  DISCORD_DEV_GUILD_ID: z.string().optional(),
  API_BASE_URL: z.string().url(),
  BOT_SERVICE_TOKEN: z.string().min(1),
  RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
});

export const env = EnvSchema.parse(process.env);
