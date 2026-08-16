import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../services/api-client.js";
import { trackMeeting } from "../services/meeting-heartbeat.js";
import { findLiveMeetingForInteraction } from "../utils/find-live-meeting.js";
import { successEmbed } from "../ui/embeds/success.embed.js";
import { errorEmbed } from "../ui/embeds/error.embed.js";

export const data = new SlashCommandBuilder()
  .setName("resume-meeting")
  .setDescription("Resume a paused meeting")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  const meeting = await findLiveMeetingForInteraction(interaction, ["PAUSED"]);
  if (!meeting) return;

  try {
    const resumed = await apiClient.meetings.resume(meeting.id, { resumedBy: interaction.user.id, observedAt: new Date() });
    trackMeeting(resumed.id, resumed.guildId, resumed.voiceChannelIds);
    await interaction.editReply({ content: null, embeds: [successEmbed("Meeting resumed")], components: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    await interaction.editReply({ content: null, embeds: [errorEmbed(message)], components: [] });
  }
}
