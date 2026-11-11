import NextAuth, { type NextAuthResult } from "next-auth";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";
import { DEMO_GUILD, DEMO_USER } from "@meeting-system/contracts";
import { fetchBotGuildIds, fetchUserGuilds, intersectGuilds } from "./lib/guild-membership";
import { DEMO_PROVIDER_ID, isDemoMode } from "./lib/demo-mode";
import { getServerEnv } from "./lib/server-env";

export const { handlers, signIn, signOut, auth, unstable_update }: NextAuthResult = NextAuth({
  providers: [
    Discord({
      // Auth.js v5's automatic env-var inference only looks for
      // AUTH_DISCORD_ID/AUTH_DISCORD_SECRET — this repo uses
      // DISCORD_CLIENT_ID/DISCORD_CLIENT_SECRET everywhere else, so they
      // must be passed explicitly or clientId silently resolves to
      // undefined and Discord rejects the OAuth request.
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify guilds" } },
    }),
    ...(isDemoMode()
      ? [
          Credentials({
            id: DEMO_PROVIDER_ID,
            name: "Demo",
            credentials: {},
            authorize: () => ({ id: DEMO_USER.discordUserId, name: DEMO_USER.username }),
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account }) {
      // Membership in a *specific* guild is no longer checked here — this
      // dashboard is multi-tenant now. Any authenticated Discord user may
      // sign in; which guilds they can actually see data for is resolved in
      // `jwt` below, as the intersection of their guilds and the bot's.
      getServerEnv();
      if (account?.provider === DEMO_PROVIDER_ID) {
        return isDemoMode();
      }
      return !!account?.access_token;
    },
    async jwt({ token, account, profile, trigger, session }) {
      if (account?.provider === DEMO_PROVIDER_ID) {
        token.discordUserId = DEMO_USER.discordUserId;
        token.username = DEMO_USER.username;
        token.availableGuilds = [{ id: DEMO_GUILD.id, name: DEMO_GUILD.name, icon: null, canManage: true }];
        token.selectedGuildId = DEMO_GUILD.id;
        return token;
      }

      if (profile) {
        token.discordUserId = profile.id as string;
        token.username = (profile.username as string) ?? (profile.name as string);
      }

      // Only present on the initial sign-in call — refetching on every
      // token refresh would mean an extra pair of Discord API calls per
      // request cycle for no benefit, since guild membership rarely changes
      // mid-session.
      if (account?.access_token) {
        const [userGuilds, botGuildIds] = await Promise.all([
          fetchUserGuilds(account.access_token),
          fetchBotGuildIds(getServerEnv().DISCORD_BOT_TOKEN),
        ]);
        token.availableGuilds = intersectGuilds(userGuilds, botGuildIds);

        // Skip the picker entirely for the common case — a club with one
        // server. Multi-guild members still land on /select-guild.
        if (token.availableGuilds.length === 1) {
          token.selectedGuildId = token.availableGuilds[0].id;
        }
      }

      // Fired by `unstable_update()` — either the select-guild page picking
      // a guild, or the "Switch server" action clearing the current one
      // with an empty string. The picked id is re-validated against
      // `availableGuilds` rather than trusted outright — this is the one
      // place a guildId the user doesn't actually share with the bot could
      // otherwise slip into the token.
      if (trigger === "update" && typeof session?.guildId === "string") {
        if (session.guildId === "") {
          token.selectedGuildId = undefined;
        } else if (token.availableGuilds?.some((guild) => guild.id === session.guildId)) {
          token.selectedGuildId = session.guildId;
        }
      }

      // Defensive: if the bot was removed from the previously-selected
      // guild since the last token refresh, drop the stale selection rather
      // than keep minting API tokens scoped to a guild the bot can't serve.
      if (token.selectedGuildId && !token.availableGuilds?.some((guild) => guild.id === token.selectedGuildId)) {
        token.selectedGuildId = undefined;
      }

      return token;
    },
    async session({ session, token }) {
      const discordUserId = token.discordUserId as string;
      const username = token.username as string;

      session.user.discordUserId = discordUserId;
      session.user.username = username;
      session.availableGuilds = token.availableGuilds ?? [];

      const selectedGuildId = token.selectedGuildId;
      session.guildId = selectedGuildId ?? "";

      // Read from the guild list captured at sign-in, so a permission change in
      // Discord takes effect on the next sign-in, not mid-session.
      const canManage = token.availableGuilds?.find((guild) => guild.id === selectedGuildId)?.canManage ?? false;
      session.canManage = canManage;

      // No guild selected yet — no API token to mint. `app/(app)/layout.tsx`
      // redirects to /select-guild before any page could try to use one.
      if (!selectedGuildId) {
        session.apiToken = "";
        return session;
      }

      // Minted fresh per session read: the JWT the dashboard presents to
      // the API, scoped to the guild the user picked. The API refuses writes
      // from a token without `canManage`.
      session.apiToken = await new SignJWT({
        discordUserId,
        username,
        guildId: selectedGuildId,
        canManage,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(new TextEncoder().encode(getServerEnv().API_JWT_SECRET));

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
