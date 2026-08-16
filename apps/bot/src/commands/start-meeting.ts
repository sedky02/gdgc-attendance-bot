import {
  ActionRowBuilder,
  ComponentType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { ExpectedMember, MeetingType } from "@meeting-system/contracts";
import { apiClient } from "../services/api-client.js";
import { trackMeeting } from "../services/meeting-heartbeat.js";
import { successEmbed } from "../ui/embeds/success.embed.js";
import { errorEmbed } from "../ui/embeds/error.embed.js";

const TYPE_SELECT_ID = "start-meeting-type-select";
const SELECT_TIMEOUT_MS = 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("start-meeting")
  .setDescription("Start a meeting in your current voice channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: "You need to be in a voice channel to start a meeting.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const meetingTypes = await apiClient.meetingTypes.list(interaction.guildId, false);
  if (meetingTypes.length === 0) {
    await interaction.editReply("No meeting types configured yet — run /configure-meeting first.");
    return;
  }

  const typeSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(TYPE_SELECT_ID)
      .setPlaceholder("Select the type of meeting to start")
      .addOptions(meetingTypes.map((type) => ({ label: type.name, value: type.id }))),
  );

  await interaction.editReply({ content: "What kind of meeting is this?", components: [typeSelectRow] });
  const promptMessage = await interaction.fetchReply();

  try {
    const typeSelect = await promptMessage.awaitMessageComponent({
      filter: (i) => i.customId === TYPE_SELECT_ID && i.user.id === interaction.user.id,
      componentType: ComponentType.StringSelect,
      time: SELECT_TIMEOUT_MS,
    });

    const meetingType = meetingTypes.find((type) => type.id === typeSelect.values[0]);
    if (!meetingType) {
      await typeSelect.update({ content: "That meeting type no longer exists.", components: [] });
      return;
    }

    await typeSelect.deferUpdate();

    const expectedMembers = await snapshotExpectedMembers(interaction.guild, meetingType);

    const meeting = await apiClient.meetings.start({
      guildId: interaction.guildId,
      meetingTypeId: meetingType.id,
      voiceChannelIds: [voiceChannel.id],
      startedBy: interaction.user.id,
      expectedMembers,
      observedAt: new Date(),
    });

    trackMeeting(meeting.id, interaction.guildId, meeting.voiceChannelIds);

    await interaction.editReply({
      content: null,
      embeds: [
        successEmbed(
          `Started "${meetingType.name}"`,
          `Channel: ${voiceChannel.name}\nExpected: ${expectedMembers.length}`,
        ),
      ],
      components: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request timed out.";
    await interaction.editReply({ content: null, embeds: [errorEmbed(message)], components: [] }).catch(() => undefined);
  }
}

/**
 * Members expected to attend are whoever currently holds one of the type's
 * roles — snapshotted now so a role change next semester can't retroactively
 * rewrite this meeting's record. An empty role list means nobody is
 * specifically expected; anyone who attends shows up as unexpected.
 */
async function snapshotExpectedMembers(
  guild: ChatInputCommandInteraction["guild"],
  meetingType: MeetingType,
): Promise<ExpectedMember[]> {
  if (!guild || meetingType.roles.length === 0) {
    return [];
  }

  const expectedRoleIds = new Set(meetingType.roles.map((role) => role.roleId));
  const members = await guild.members.fetch();

  return members
    .filter((member: GuildMember) => !member.user.bot && member.roles.cache.some((role) => expectedRoleIds.has(role.id)))
    .map((member: GuildMember) => ({
      discordUserId: member.id,
      usernameSnapshot: member.user.username,
      roleIds: [...member.roles.cache.keys()].filter((roleId) => roleId !== guild.id),
    }));
}
