import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../../services/api-client.js";
import { successEmbed } from "../../ui/embeds/success.embed.js";
import { replyWithError } from "../../ui/reply-error.js";
import { promptMeetingTypeSelect } from "../../ui/selects/meeting-type-select-prompt.js";
import { DEFAULT_SELECT_TIMEOUT_MS } from "../../ui/constants.js";
import { replyGuildOnlyError, replyNoMeetingTypesError } from "../../utils/interaction-guards.js";
import { TYPE_SELECT_ID } from "./constants.js";

export const data = new SlashCommandBuilder()
  .setName("delete-meeting-type")
  .setDescription("Archive a meeting type so it can no longer be used to start meetings")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await replyGuildOnlyError(interaction);
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const meetingTypes = await apiClient.meetingTypes.list(interaction.guildId, false);
  if (meetingTypes.length === 0) {
    await replyNoMeetingTypesError(interaction);
    return;
  }

  try {
    const typeSelect = await promptMeetingTypeSelect(interaction, meetingTypes, {
      customId: TYPE_SELECT_ID,
      content: "Which meeting type do you want to delete?",
      placeholder: "Select a meeting type to delete",
      timeoutMs: DEFAULT_SELECT_TIMEOUT_MS,
    });

    const archived = await apiClient.meetingTypes.archive(typeSelect.values[0]);

    await typeSelect.update({
      content: null,
      embeds: [
        successEmbed(
          `Deleted "${archived.name}"`,
          "It can no longer be used to start meetings. Past meetings of this type keep their records.",
        ),
      ],
      components: [],
    });
  } catch (error) {
    await replyWithError(interaction, error, { mode: "editReply", swallow: true, fallbackMessage: "The request timed out." });
  }
}
