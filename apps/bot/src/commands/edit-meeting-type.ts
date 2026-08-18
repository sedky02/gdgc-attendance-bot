import {
  ActionRowBuilder,
  ComponentType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { apiClient } from "../services/api-client.js";
import { successEmbed } from "../ui/embeds/success.embed.js";
import { errorEmbed } from "../ui/embeds/error.embed.js";
import { rolesToSnapshot } from "../utils/role-snapshot.js";

const TYPE_SELECT_ID = "edit-meeting-type-select";
const NAME_INPUT_ID = "name";
const ROLE_SELECT_ID = "edit-meeting-type-roles";
const INTERACTION_TIMEOUT_MS = 5 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("edit-meeting-type")
  .setDescription("Edit an existing meeting type")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const meetingTypes = await apiClient.meetingTypes.list(interaction.guildId, false);
  if (meetingTypes.length === 0) {
    await interaction.editReply("No meeting types configured yet — run /configure-meeting first.");
    return;
  }

  const typeSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(TYPE_SELECT_ID)
      .setPlaceholder("Select a meeting type to edit")
      .addOptions(meetingTypes.map((type) => ({ label: type.name, value: type.id }))),
  );

  await interaction.editReply({ content: "Which meeting type do you want to edit?", components: [typeSelectRow] });
  const promptMessage = await interaction.fetchReply();

  try {
    const typeSelect = await promptMessage.awaitMessageComponent({
      filter: (i) => i.customId === TYPE_SELECT_ID && i.user.id === interaction.user.id,
      componentType: ComponentType.StringSelect,
      time: INTERACTION_TIMEOUT_MS,
    });

    const meetingType = meetingTypes.find((type) => type.id === typeSelect.values[0]);
    if (!meetingType) {
      await typeSelect.update({ content: "That meeting type no longer exists.", components: [] });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`edit-meeting-type-${typeSelect.id}`)
      .setTitle("Edit meeting type")
      .addLabelComponents(
        new LabelBuilder().setLabel("Name").setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(NAME_INPUT_ID)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setValue(meetingType.name)
            .setRequired(true),
        ),
      );

    await typeSelect.showModal(modal);

    const modalSubmit = await typeSelect.awaitModalSubmit({
      filter: (i) => i.customId === modal.data.custom_id && i.user.id === interaction.user.id,
      time: INTERACTION_TIMEOUT_MS,
    });

    const name = modalSubmit.fields.getTextInputValue(NAME_INPUT_ID);

    const roleSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(ROLE_SELECT_ID)
        .setPlaceholder("Select the roles expected to attend (optional)")
        .setMinValues(0)
        .setMaxValues(25)
        .setDefaultRoles(meetingType.roles.map((role) => role.roleId)),
    );

    await modalSubmit.reply({
      content: `Roles expected for **${name}**:`,
      components: [roleSelectRow],
      flags: MessageFlags.Ephemeral,
    });
    const rolePromptMessage = await modalSubmit.fetchReply();

    const roleSelect = await rolePromptMessage.awaitMessageComponent({
      filter: (i) => i.customId === ROLE_SELECT_ID && i.user.id === interaction.user.id,
      componentType: ComponentType.RoleSelect,
      time: INTERACTION_TIMEOUT_MS,
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
    const message = error instanceof Error ? error.message : "The request timed out.";
    await interaction.editReply({ content: null, embeds: [errorEmbed(message)], components: [] }).catch(() => undefined);
  }
}
