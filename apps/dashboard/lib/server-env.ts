import { z } from "zod";
import { isDemoMode } from "./demo-mode";

const BaseEnv = z.object({
  API_JWT_SECRET: z.string().min(32, "must be at least 32 characters and match the API's JWT_SECRET"),
});

const DiscordEnv = z.object({
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
});

export interface ServerEnv {
  API_JWT_SECRET: string;
  DISCORD_BOT_TOKEN: string;
}

// The Discord credentials are only optional in demo mode, where nobody signs in through Discord.
export function parseServerEnv(env: Record<string, string | undefined>): ServerEnv {
  const schema = isDemoMode(env) ? BaseEnv.merge(DiscordEnv.partial()) : BaseEnv.merge(DiscordEnv);
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid dashboard environment (${problems}). See apps/dashboard/.env.example.`);
  }
  return { API_JWT_SECRET: result.data.API_JWT_SECRET, DISCORD_BOT_TOKEN: result.data.DISCORD_BOT_TOKEN ?? "" };
}

let cached: ServerEnv | undefined;

// Read on first use rather than at import, so `next build` works without runtime secrets.
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
