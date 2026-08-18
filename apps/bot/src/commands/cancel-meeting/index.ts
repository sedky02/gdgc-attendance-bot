import { PermissionFlagsBits, SlashCommandBuilder, TextInputStyle, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../../services/api-client.js";
import { untrackMeeting } from "../../services/reconciler.js";
import { findLiveMeetingForInteraction } from "../../utils/find-live-meeting.js";
import { successEmbed } from "../../ui/embeds/success.embed.js";
import { replyWithError } from "../../ui/reply-error.js";
import { awaitModal, buildSingleFieldModal } from "../../ui/modals/text-input-modal.js";
import { DEFAULT_MODAL_TIMEOUT_MS } from "../../ui/constants.js";
import { replyGuildOnlyError } from "../../utils/interaction-guards.js";
import { REASON_INPUT_ID } from "./constants.js";

export const data = new SlashCommandBuilder()
  .setName("cancel-meeting")
  .setDescription("Cancel the active meeting")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await replyGuildOnlyError(interaction);
    return;
  }

  const modal = buildSingleFieldModal({
    customId: `cancel-meeting-${interaction.id}`,
    title: "Cancel meeting",
    label: "Reason",
    fieldId: REASON_INPUT_ID,
    style: TextInputStyle.Paragraph,
    maxLength: 500,
  });

  const modalSubmit = await awaitModal(interaction, modal, DEFAULT_MODAL_TIMEOUT_MS).catch(() => null);
  if (!modalSubmit) return;

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
    await replyWithError(modalSubmit, error, { mode: "auto", swallow: true, fallbackMessage: "Something went wrong." });
  }
}
