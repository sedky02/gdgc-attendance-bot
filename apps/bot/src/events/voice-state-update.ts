import type { Client, VoiceState } from "discord.js";
import { apiClient } from "../services/api-client.js";
import { enqueue } from "../services/event-queue.js";

export function registerVoiceStateUpdateEvent(client: Client): void {
  client.on("voiceStateUpdate", (oldState: VoiceState, newState: VoiceState) => {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) {
      return;
    }

    // Mute, deafen, self-video, streaming, and suppress all fire this event
    // without a channel change — only a channel change is attendance-relevant.
    if (oldState.channelId === newState.channelId) {
      return;
    }

    const guild = newState.guild;
    // The AFK channel counts as leaving, not as being present — on either
    // side of the transition, so moving out of AFK into a real channel
    // reads as a fresh join, not a channel move.
    const from = oldState.channelId === guild.afkChannelId ? null : oldState.channelId;
    const to = newState.channelId === guild.afkChannelId ? null : newState.channelId;
    const occurredAt = new Date();

    enqueue(member.id, () =>
      apiClient.internal.voiceEvent({
        guildId: guild.id,
        discordUserId: member.id,
        usernameSnapshot: member.user.username,
        displayNameSnapshot: member.displayName,
        from,
        to,
        occurredAt,
      }),
    );
  });
}
