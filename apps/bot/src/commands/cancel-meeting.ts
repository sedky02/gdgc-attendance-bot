import {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { apiClient } from "../services/api-client.js";
import { untrackMeeting } from "../services/reconciler.js";
import { findLiveMeetingForInteraction } from "../utils/find-live-meeting.js";
import { successEmbed } from "../ui/embeds/success.embed.js";
import { errorEmbed } from "../ui/embeds/error.embed.js";

const REASON_INPUT_ID = "reason";
const MODAL_TIMEOUT_MS = 5 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("cancel-meeting")
  .setDescription("Cancel the active meeting")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`cancel-meeting-${interaction.id}`)
    .setTitle("Cancel meeting")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(REASON_INPUT_ID)
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);

  let modalSubmit: ModalSubmitInteraction;
  try {
    modalSubmit = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === modal.data.custom_id && i.user.id === interaction.user.id,
      time: MODAL_TIMEOUT_MS,
    });
  } catch {
    return;
  }

  const cancelReason = modalSubmit.fields.getTextInputValue(REASON_INPUT_ID);

  try {
    const meeting = await findLiveMeetingForInteraction(modalSubmit, ["ACTIVE", "PAUSED"]);
    if (!meeting) return;

    await apiClient.meetings.cancel(meeting.id, {
      cancelledBy: interaction.user.id,
      cancelReason,
      observedAt: new Date(),
    });
    untrackMeeting(meeting.id);

    await modalSubmit.editReply({ content: null, embeds: [successEmbed("Meeting cancelled", cancelReason)], components: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    if (modalSubmit.deferred || modalSubmit.replied) {
      await modalSubmit.editReply({ content: null, embeds: [errorEmbed(message)], components: [] }).catch(() => undefined);
    } else {
      await modalSubmit.reply({ embeds: [errorEmbed(message)], ephemeral: true }).catch(() => undefined);
    }
  }
}
