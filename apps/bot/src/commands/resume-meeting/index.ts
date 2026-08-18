import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../../services/api-client.js";
import { trackMeeting } from "../../services/reconciler.js";
import { findLiveMeetingForInteraction } from "../../utils/find-live-meeting.js";
import { getPresentMembers } from "../../utils/present-members.js";
import { successEmbed } from "../../ui/embeds/success.embed.js";
import { replyWithError } from "../../ui/reply-error.js";

export const data = new SlashCommandBuilder()
  .setName("resume-meeting")
  .setDescription("Resume a paused meeting")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  const meeting = await findLiveMeetingForInteraction(interaction, ["PAUSED"]);
  if (!meeting) return;

  try {
    const presentMembers = interaction.guild ? await getPresentMembers(interaction.guild, meeting.voiceChannelIds) : [];

    const resumed = await apiClient.meetings.resume(meeting.id, {
      resumedBy: interaction.user.id,
      observedAt: new Date(),
      presentMembers,
    });
    trackMeeting(resumed.id, resumed.guildId, resumed.voiceChannelIds);
    await interaction.editReply({ content: null, embeds: [successEmbed("Meeting resumed")], components: [] });
  } catch (error) {
    await replyWithError(interaction, error, { mode: "editReply", fallbackMessage: "Something went wrong." });
  }
}
