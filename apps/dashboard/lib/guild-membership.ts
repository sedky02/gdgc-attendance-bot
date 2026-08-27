export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

export function isGuildMember(guilds: DiscordGuild[], guildId: string): boolean {
  return guilds.some((guild) => guild.id === guildId);
}

/**
 * Guilds where both the signed-in user and the bot are present — the only
 * guilds this multi-tenant dashboard can show data for, since the bot has
 * nothing to manage anywhere else. Computed as an intersection rather than
 * trusting either side alone: a user's own guild list says nothing about
 * whether the bot is installed there, and the bot's guild list says nothing
 * about whether this particular user belongs to it.
 */
export function intersectGuilds(userGuilds: DiscordGuild[], botGuildIds: ReadonlySet<string>): DiscordGuild[] {
  return userGuilds.filter((guild) => botGuildIds.has(guild.id));
}

export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return [];
  return response.json();
}

/**
 * The bot's own guild list, via its bot token — same Discord endpoint, a
 * different authorization scheme. Not paginated: Discord returns up to 200
 * guilds per page and this club-scale deployment won't approach that (the
 * README's roadmap doesn't consider sharding until 2,500+ guilds).
 */
export async function fetchBotGuildIds(botToken: string): Promise<Set<string>> {
  const response = await fetch("https://discord.com/api/users/@me/guilds?limit=200", {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!response.ok) return new Set();
  const guilds: DiscordGuild[] = await response.json();
  return new Set(guilds.map((guild) => guild.id));
}
