import { MessageFlags, type RepliableInteraction } from "discord.js";

/**
 * Generic precondition replies shared across commands. Each function only
 * sends the reply — the narrowing check itself (`interaction.inGuild()`,
 * `interaction.inCachedGuild()`, `voiceChannel !== null`, ...) stays inline
 * at the call site: discord.js narrows the interaction's type through those
 * checks, and moving the check into a helper would lose that narrowing for
 * everything after it.
 *
 * Usage:
 * ```ts
 * if (!interaction.inGuild()) {
 *   await replyGuildOnlyError(interaction);
 *   return;
 * }
 * ```
 */

export async function replyGuildOnlyError(interaction: RepliableInteraction): Promise<void> {
  await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
}

export async function replyNotInVoiceChannelError(interaction: RepliableInteraction): Promise<void> {
  await interaction.reply({
    content: "You need to be in a voice channel to start a meeting.",
    flags: MessageFlags.Ephemeral,
  });
}

/** `interaction` must already be deferred/replied — this edits that reply. */
export async function replyNoMeetingTypesError(interaction: RepliableInteraction): Promise<void> {
  await interaction.editReply("No meeting types configured yet — run /configure-meeting first.");
}
