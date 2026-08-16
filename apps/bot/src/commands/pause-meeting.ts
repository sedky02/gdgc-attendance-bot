import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../services/api-client.js";
import { untrackMeeting } from "../services/reconciler.js";
import { findLiveMeetingForInteraction } from "../utils/find-live-meeting.js";
import { successEmbed } from "../ui/embeds/success.embed.js";
import { errorEmbed } from "../ui/embeds/error.embed.js";

export const data = new SlashCommandBuilder()
  .setName("pause-meeting")
  .setDescription("Pause the active meeting")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  const meeting = await findLiveMeetingForInteraction(interaction, ["ACTIVE"]);
  if (!meeting) return;

  try {
    await apiClient.meetings.pause(meeting.id, { pausedBy: interaction.user.id, observedAt: new Date() });
    untrackMeeting(meeting.id);
    await interaction.editReply({ content: null, embeds: [successEmbed("Meeting paused")], components: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    await interaction.editReply({ content: null, embeds: [errorEmbed(message)], components: [] });
  }
}
