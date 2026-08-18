import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../../services/api-client.js";
import { successEmbed } from "../../ui/embeds/success.embed.js";
import { replyWithError } from "../../ui/reply-error.js";
import { awaitModal, buildSingleFieldModal } from "../../ui/modals/text-input-modal.js";
import { promptRoleSelect } from "../../ui/selects/role-select-prompt.js";
import { promptMeetingTypeSelect } from "../../ui/selects/meeting-type-select-prompt.js";
import { DEFAULT_MODAL_TIMEOUT_MS } from "../../ui/constants.js";
import { replyGuildOnlyError, replyNoMeetingTypesError } from "../../utils/interaction-guards.js";
import { rolesToSnapshot } from "../../utils/role-snapshot.js";
import { NAME_INPUT_ID, ROLE_SELECT_ID, TYPE_SELECT_ID } from "./constants.js";

export const data = new SlashCommandBuilder()
  .setName("edit-meeting-type")
  .setDescription("Edit an existing meeting type")
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
      content: "Which meeting type do you want to edit?",
      placeholder: "Select a meeting type to edit",
      timeoutMs: DEFAULT_MODAL_TIMEOUT_MS,
    });

    const meetingType = meetingTypes.find((type) => type.id === typeSelect.values[0]);
    if (!meetingType) {
      await typeSelect.update({ content: "That meeting type no longer exists.", components: [] });
      return;
    }

    const modal = buildSingleFieldModal({
      customId: `edit-meeting-type-${typeSelect.id}`,
      title: "Edit meeting type",
      label: "Name",
      fieldId: NAME_INPUT_ID,
      maxLength: 100,
      value: meetingType.name,
    });

    const modalSubmit = await awaitModal(typeSelect, modal, DEFAULT_MODAL_TIMEOUT_MS);
    const name = modalSubmit.fields.getTextInputValue(NAME_INPUT_ID);

    const roleSelect = await promptRoleSelect(modalSubmit, {
      customId: ROLE_SELECT_ID,
      content: `Roles expected for **${name}**:`,
      placeholder: "Select the roles expected to attend (optional)",
      minValues: 0,
      maxValues: 25,
      defaultRoleIds: meetingType.roles.map((role) => role.roleId),
      timeoutMs: DEFAULT_MODAL_TIMEOUT_MS,
    });

    const roles = rolesToSnapshot(roleSelect.roles.values());

    const updated = await apiClient.meetingTypes.update(meetingType.id, { name, roles });

    await roleSelect.update({
      content: null,
      embeds: [
        successEmbed(
          `Updated "${updated.name}"`,
          updated.roles.length > 0
            ? `Expected roles: ${updated.roles.map((r) => r.nameSnapshot).join(", ")}`
            : "No expected roles set — anyone who attends counts as expected.",
        ),
      ],
      components: [],
    });
  } catch (error) {
    await replyWithError(interaction, error, { mode: "editReply", swallow: true, fallbackMessage: "The request timed out." });
  }
}
