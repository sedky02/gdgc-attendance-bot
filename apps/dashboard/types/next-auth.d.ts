import type { DefaultSession } from "next-auth";
import type { DiscordGuild } from "@/lib/guild-membership";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      discordUserId: string;
      username: string;
    };
    /** Guilds shared by the signed-in user and the bot — the picker's options. */
    availableGuilds: DiscordGuild[];
    /**
     * Empty string until the user picks one of `availableGuilds`. Consuming
     * pages under `app/(app)/` never actually see the empty case — the
     * layout redirects to `/select-guild` first — but the type stays a
     * plain `string` (rather than `string | undefined`) so those pages don't
     * need to thread an optionality check that can never trigger for them.
     */
    guildId: string;
    apiToken: string;
  }
}

// `next-auth/jwt` only re-exports JWT via `export * from "@auth/core/jwt"`,
// and augmenting a module that re-exports with `export *` doesn't reliably
// merge into the original interface (unlike Session above, which next-auth
// re-exports by name and which does merge) — augment the real declaring
// module directly instead.
declare module "@auth/core/jwt" {
  interface JWT {
    discordUserId?: string;
    username?: string;
    availableGuilds?: DiscordGuild[];
    selectedGuildId?: string;
  }
}
