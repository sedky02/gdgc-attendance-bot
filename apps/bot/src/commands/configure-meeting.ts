import {
  ActionRowBuilder,
  ComponentType,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { apiClient } from "../services/api-client.js";
import { successEmbed } from "../ui/embeds/success.embed.js";
import { errorEmbed } from "../ui/embeds/error.embed.js";
import { rolesToSnapshot } from "../utils/role-snapshot.js";

const NAME_INPUT_ID = "name";
const ROLE_SELECT_ID = "configure-meeting-roles";
const MODAL_TIMEOUT_MS = 5 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("configure-meeting")
  .setDescription("Create a new meeting type")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`configure-meeting-${interaction.id}`)
    .setTitle("New meeting type")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(NAME_INPUT_ID)
          .setLabel("Name")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);

  try {
    const modalSubmit = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === modal.data.custom_id && i.user.id === interaction.user.id,
      time: MODAL_TIMEOUT_MS,
    });

    const name = modalSubmit.fields.getTextInputValue(NAME_INPUT_ID);

    const roleSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(ROLE_SELECT_ID)
        .setPlaceholder("Select the roles expected to attend (optional)")
        .setMinValues(0)
        .setMaxValues(25),
    );

    await modalSubmit.reply({
      content: `Roles expected for **${name}**:`,
      components: [roleSelectRow],
      ephemeral: true,
    });
    const promptMessage = await modalSubmit.fetchReply();

    const roleSelect = await promptMessage.awaitMessageComponent({
      filter: (i) => i.customId === ROLE_SELECT_ID && i.user.id === interaction.user.id,
      componentType: ComponentType.RoleSelect,
      time: MODAL_TIMEOUT_MS,
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
          meetingType.roles.length > 0
            ? `Expected roles: ${meetingType.roles.map((r) => r.nameSnapshot).join(", ")}`
            : "No expected roles set — anyone who attends counts as expected.",
        ),
      ],
      components: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request timed out.";
    await interaction.followUp({ embeds: [errorEmbed(message)], ephemeral: true }).catch(() => undefined);
  }
}
