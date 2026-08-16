import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../services/api-client.js";
import { untrackMeeting } from "../services/reconciler.js";
import { findLiveMeetingForInteraction } from "../utils/find-live-meeting.js";
import { successEmbed } from "../ui/embeds/success.embed.js";
import { errorEmbed } from "../ui/embeds/error.embed.js";

export const data = new SlashCommandBuilder()
  .setName("end-meeting")
  .setDescription("End the active meeting")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  const meeting = await findLiveMeetingForInteraction(interaction, ["ACTIVE", "PAUSED"]);
  if (!meeting) return;

  try {
    await apiClient.meetings.end(meeting.id, { endedBy: interaction.user.id, observedAt: new Date() });
    untrackMeeting(meeting.id);
    // The full attendance report is posted here starting in Phase 5.
    await interaction.editReply({ content: null, embeds: [successEmbed("Meeting ended")], components: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    await interaction.editReply({ content: null, embeds: [errorEmbed(message)], components: [] });
  }
}
