import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../../services/api-client.js";
import { successEmbed } from "../../ui/embeds/success.embed.js";
import { replyWithError } from "../../ui/reply-error.js";
import { awaitModal, buildSingleFieldModal } from "../../ui/modals/text-input-modal.js";
import { promptRoleSelect } from "../../ui/selects/role-select-prompt.js";
import { DEFAULT_MODAL_TIMEOUT_MS } from "../../ui/constants.js";
import { replyGuildOnlyError } from "../../utils/interaction-guards.js";
import { rolesToSnapshot } from "../../utils/role-snapshot.js";
import { NAME_INPUT_ID, ROLE_SELECT_ID } from "./constants.js";

export const data = new SlashCommandBuilder()
  .setName("configure-meeting")
  .setDescription("Create a new meeting type")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await replyGuildOnlyError(interaction);
    return;
  }

  const modal = buildSingleFieldModal({
    customId: `configure-meeting-${interaction.id}`,
    title: "New meeting type",
    label: "Name",
    fieldId: NAME_INPUT_ID,
    maxLength: 100,
  });

  try {
    const modalSubmit = await awaitModal(interaction, modal, DEFAULT_MODAL_TIMEOUT_MS);
    const name = modalSubmit.fields.getTextInputValue(NAME_INPUT_ID);

    const roleSelect = await promptRoleSelect(modalSubmit, {
      customId: ROLE_SELECT_ID,
      content: `Roles expected for **${name}**:`,
      placeholder: "Select the roles expected to attend (at least 1 role)",
      minValues: 1,
      maxValues: 25,
      timeoutMs: DEFAULT_MODAL_TIMEOUT_MS,
    });

    const roles = rolesToSnapshot(roleSelect.roles.values());

    const meetingType = await apiClient.meetingTypes.create({
      guildId: interaction.guildId,
      name,
      roles,
      createdBy: interaction.user.id,
    });

    await roleSelect.update({
      content: null,
      embeds: [
        successEmbed(
          `Created "${meetingType.name}"`,
          `Expected roles: ${meetingType.roles.map((r) => r.nameSnapshot).join(", ")}`,
        ),
      ],
      components: [],
    });
  } catch (error) {
    await replyWithError(interaction, error, { mode: "followUp", swallow: true, fallbackMessage: "The request timed out." });
  }
}
