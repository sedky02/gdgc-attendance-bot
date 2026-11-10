export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  canManage: boolean;
}

interface RawDiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
}

const ADMINISTRATOR = BigInt(1) << BigInt(3);
const MANAGE_EVENTS = BigInt(1) << BigInt(33);

// Mirrors the bot, whose manager commands default to the Manage Events permission.
export function hasManagerPermission(guild: { owner?: boolean; permissions?: string }): boolean {
  if (guild.owner) return true;
  if (!guild.permissions) return false;
  return (BigInt(guild.permissions) & (ADMINISTRATOR | MANAGE_EVENTS)) !== BigInt(0);
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
  const guilds: RawDiscordGuild[] = await response.json();
  return guilds.map((guild) => ({
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    canManage: hasManagerPermission(guild),
  }));
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
  const guilds: { id: string }[] = await response.json();
  return new Set(guilds.map((guild) => guild.id));
}
