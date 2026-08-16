export interface DiscordGuild {
  id: string;
}

export function isGuildMember(guilds: DiscordGuild[], guildId: string): boolean {
  return guilds.some((guild) => guild.id === guildId);
}
