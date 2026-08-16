import NextAuth, { type NextAuthResult } from "next-auth";
import Discord from "next-auth/providers/discord";
import { SignJWT } from "jose";
import { isGuildMember, type DiscordGuild } from "./lib/guild-membership";

const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID!;
const API_JWT_SECRET = new TextEncoder().encode(process.env.API_JWT_SECRET!);

export const { handlers, signIn, signOut, auth }: NextAuthResult = NextAuth({
  providers: [
    Discord({
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      if (!account?.access_token) return false;

      const response = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${account.access_token}` },
      });
      if (!response.ok) return false;

      const guilds: DiscordGuild[] = await response.json();
      return isGuildMember(guilds, DISCORD_GUILD_ID);
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.discordUserId = profile.id as string;
        token.username = (profile.username as string) ?? (profile.name as string);
      }
      return token;
    },
    async session({ session, token }) {
      const discordUserId = token.discordUserId as string;
      const username = token.username as string;

      session.user.discordUserId = discordUserId;
      session.user.username = username;
      session.guildId = DISCORD_GUILD_ID;

      // Minted fresh per session read: the JWT the dashboard presents to the
      // API, scoped to this guild. Role membership is filled in once the API
      // exposes a members endpoint (Phase 2+); an empty list means "no
      // elevated permissions yet", not "unauthenticated".
      session.apiToken = await new SignJWT({
        discordUserId,
        username,
        guildId: DISCORD_GUILD_ID,
        roleIds: [],
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(API_JWT_SECRET);

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
