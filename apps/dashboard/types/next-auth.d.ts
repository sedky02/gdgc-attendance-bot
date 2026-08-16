import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      discordUserId: string;
      username: string;
    };
    apiToken: string;
    guildId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordUserId?: string;
    username?: string;
  }
}
