import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../../services/api-client.js";
import { untrackMeeting } from "../../services/reconciler.js";
import { findLiveMeetingForInteraction } from "../../utils/find-live-meeting.js";
import { reportEmbed } from "../../ui/embeds/report.embed.js";
import { replyWithError } from "../../ui/reply-error.js";

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

    const [report, meetingType] = await Promise.all([
      apiClient.meetings.getReport(meeting.id),
      apiClient.meetingTypes.get(meeting.meetingType),
    ]);

    await interaction.editReply({ content: null, embeds: [reportEmbed(meetingType.name, report)], components: [] });
  } catch (error) {
    await replyWithError(interaction, error, { mode: "editReply", fallbackMessage: "Something went wrong." });
  }
}
