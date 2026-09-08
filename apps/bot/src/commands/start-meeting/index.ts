import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { ExpectedMember, MeetingType, PresentMember } from "@meeting-system/contracts";
import { apiClient } from "../../services/api-client.js";
import { trackMeeting } from "../../services/reconciler.js";
import { trackRosterMessage } from "../../services/roster-message.js";
import { successEmbed } from "../../ui/embeds/success.embed.js";
import { rosterEmbed } from "../../ui/embeds/roster.embed.js";
import { replyWithError } from "../../ui/reply-error.js";
import { promptMeetingTypeSelect } from "../../ui/selects/meeting-type-select-prompt.js";
import { DEFAULT_SELECT_TIMEOUT_MS } from "../../ui/constants.js";
import { replyGuildOnlyError, replyNoMeetingTypesError, replyNotInVoiceChannelError } from "../../utils/interaction-guards.js";
import { logger } from "../../logger.js";
import { TYPE_SELECT_ID } from "./constants.js";

export const data = new SlashCommandBuilder()
  .setName("start-meeting")
  .setDescription("Start a meeting in your current voice channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await replyGuildOnlyError(interaction);
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let guild;
  try {
    guild = await interaction.client.guilds.fetch(interaction.guildId);
  } catch (error) {
    logger.error(
      { err: error, guildId: interaction.guildId, discordUserId: interaction.user.id },
      "Failed to fetch guild for start-meeting",
    );
    await replyWithError(interaction, error, { mode: "editReply", swallow: true, fallbackMessage: "Couldn't reach this server — try again in a moment." });
    return;
  }
  const member = await guild.members.fetch(interaction.user.id);

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await replyNotInVoiceChannelError(interaction);
    return;
  }

  const meetingTypes = await apiClient.meetingTypes.list(interaction.guildId, false);
  if (meetingTypes.length === 0) {
    await replyNoMeetingTypesError(interaction);
    return;
  }

  try {
    const typeSelect = await promptMeetingTypeSelect(interaction, meetingTypes, {
      customId: TYPE_SELECT_ID,
      content: "What kind of meeting is this?",
      placeholder: "Select the type of meeting to start",
      timeoutMs: DEFAULT_SELECT_TIMEOUT_MS,
    });

    const meetingType = meetingTypes.find((type) => type.id === typeSelect.values[0]);
    if (!meetingType) {
      await typeSelect.update({ content: "That meeting type no longer exists.", components: [] });
      return;
    }

    await typeSelect.deferUpdate();

    const expectedMembers = await snapshotExpectedMembers(guild, meetingType);
    const presentMembers: PresentMember[] = voiceChannel.members
      .filter((member) => !member.user.bot)
      .map((member) => ({
        discordUserId: member.id,
        usernameSnapshot: member.user.username,
        displayNameSnapshot: member.displayName,
      }));

    const meeting = await apiClient.meetings.start({
      guildId: interaction.guildId,
      meetingTypeId: meetingType.id,
      voiceChannelIds: [voiceChannel.id],
      startedBy: interaction.user.id,
      expectedMembers,
      presentMembers,
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

    // A separate, public, non-ephemeral message — kept in sync by the
    // reconciler's 60s tick (and by pause/resume/end/cancel firing an
    // immediate refresh) via services/roster-message.ts. Posted as a
    // follow-up, not an edit of the ephemeral reply above, since only the
    // invoker can ever see that one.
    const report = await apiClient.meetings.getReport(meeting.id);
    const rosterMessage = await interaction.followUp({ embeds: [rosterEmbed(meetingType.name, report)] });
    trackRosterMessage(meeting.id, {
      channelId: rosterMessage.channelId,
      messageId: rosterMessage.id,
      meetingTypeName: meetingType.name,
    });
  } catch (error) {
    await replyWithError(interaction, error, { mode: "editReply", swallow: true, fallbackMessage: "The request timed out." });
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
