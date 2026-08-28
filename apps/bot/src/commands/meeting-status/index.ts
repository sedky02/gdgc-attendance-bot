import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../../services/api-client.js";
import { findLiveMeetingForInteraction } from "../../utils/find-live-meeting.js";
import { rosterEmbed } from "../../ui/embeds/roster.embed.js";
import { replyWithError } from "../../ui/reply-error.js";

export const data = new SlashCommandBuilder()
  .setName("meeting-status")
  .setDescription("Show who is currently in the live meeting");

export async function execute(interaction: ChatInputCommandInteraction) {
  // Public — this is meant to be a shared status check for the whole
  // channel, not a private lookup for whoever ran the command.
  const meeting = await findLiveMeetingForInteraction(interaction, ["ACTIVE", "PAUSED"], { ephemeral: false });
  if (!meeting) return;

  try {
    const [report, meetingType] = await Promise.all([
      apiClient.meetings.getReport(meeting.id),
      apiClient.meetingTypes.get(meeting.meetingType),
    ]);

    await interaction.editReply({ content: null, embeds: [rosterEmbed(meetingType.name, report)], components: [] });
  } catch (error) {
    await replyWithError(interaction, error, { mode: "editReply", fallbackMessage: "Something went wrong." });
  }
}
