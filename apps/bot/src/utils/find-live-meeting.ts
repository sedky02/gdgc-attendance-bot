import {
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { Meeting } from "@meeting-system/contracts";
import { apiClient } from "../services/api-client.js";

type ResolvableInteraction = ChatInputCommandInteraction | ModalSubmitInteraction;

const SELECT_ID = "find-live-meeting-select";
const SELECT_TIMEOUT_MS = 60 * 1000;

/**
 * Resolves which meeting a lifecycle command (/pause, /resume, /end, /cancel)
 * should act on. Prefers the meeting running in the caller's current voice
 * channel; falls back to a select menu over all matching live meetings so a
 * manager acting from outside voice (or the wrong channel) isn't stuck.
 *
 * Always leaves `interaction` deferred (ephemeral) by the time it returns, so
 * callers can uniformly finish with `interaction.editReply(...)` regardless
 * of which path was taken. Returns null if there's nothing to act on or the
 * user didn't complete the selection — the reply has already been sent.
 */
export async function findLiveMeetingForInteraction(
  interaction: ResolvableInteraction,
  requiredStatuses: readonly Meeting["status"][],
): Promise<Meeting | null> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return null;
  }

  await interaction.deferReply({ ephemeral: true });

  const liveMeetings = await apiClient.meetings.listActive(interaction.guildId);
  const candidates = liveMeetings.filter((meeting) => requiredStatuses.includes(meeting.status));

  const voiceChannelId = interaction.inCachedGuild() ? interaction.member.voice.channelId : null;
  const direct = voiceChannelId ? candidates.find((meeting) => meeting.voiceChannelIds.includes(voiceChannelId)) : undefined;
  if (direct) {
    return direct;
  }

  if (candidates.length === 0) {
    await interaction.editReply("There's no meeting in that state to act on right now.");
    return null;
  }

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(SELECT_ID)
      .setPlaceholder("Select a meeting")
      .addOptions(
        candidates.map((meeting) => ({
          label: `${meeting.voiceChannelIds.join(", ")} — ${meeting.status}`,
          value: meeting.id,
        })),
      ),
  );

  await interaction.editReply({ content: "Which meeting?", components: [row] });
  const promptMessage = await interaction.fetchReply();

  try {
    const select = await promptMessage.awaitMessageComponent({
      filter: (i) => i.customId === SELECT_ID && i.user.id === interaction.user.id,
      componentType: ComponentType.StringSelect,
      time: SELECT_TIMEOUT_MS,
    });

    const chosen = candidates.find((meeting) => meeting.id === select.values[0]);
    if (!chosen) {
      await select.update({ content: "That meeting is no longer available.", components: [] });
      return null;
    }

    await select.deferUpdate();
    return chosen;
  } catch {
    await interaction.editReply({ content: "Timed out waiting for a selection.", components: [] }).catch(() => undefined);
    return null;
  }
}
