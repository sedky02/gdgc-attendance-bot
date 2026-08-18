import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../services/api-client.js";
import { findLiveMeetingForInteraction } from "../utils/find-live-meeting.js";
import { successEmbed } from "../ui/embeds/success.embed.js";

export const data = new SlashCommandBuilder()
  .setName("meeting-status")
  .setDescription("Show who is currently in the live meeting");

export async function execute(interaction: ChatInputCommandInteraction) {
  const meeting = await findLiveMeetingForInteraction(interaction, ["ACTIVE", "PAUSED"]);
  if (!meeting) return;

  const attendance = await apiClient.meetings.getAttendance(meeting.id);
  const present = attendance.filter((a) => a.sessions.some((session) => session.leftAt === null));

  const description =
    present.length > 0
      ? present.map((a) => (a.expected ? a.displayNameSnapshot : `${a.displayNameSnapshot} (unexpected)`)).join("\n")
      : "Nobody is currently present.";

  await interaction.editReply({
    content: null,
    embeds: [successEmbed(meeting.status === "PAUSED" ? "Meeting paused" : "Meeting live", description)],
    components: [],
  });
}
