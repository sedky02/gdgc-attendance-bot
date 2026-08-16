import type { Guild } from "discord.js";
import type { PresentMember } from "@meeting-system/contracts";

export async function getPresentMembers(guild: Guild, voiceChannelIds: string[]): Promise<PresentMember[]> {
  const members: PresentMember[] = [];

  for (const channelId of voiceChannelIds) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isVoiceBased()) continue;

    for (const member of channel.members.values()) {
      if (member.user.bot) continue;
      members.push({
        discordUserId: member.id,
        usernameSnapshot: member.user.username,
        displayNameSnapshot: member.displayName,
      });
    }
  }

  return members;
}
