import {
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { MeetingType } from "@meeting-system/contracts";

interface PromptMeetingTypeSelectOptions {
  customId: string;
  content: string;
  placeholder: string;
  timeoutMs: number;
}

/**
 * Shared by /start-meeting and /edit-meeting-type: shows a select menu over
 * an already-fetched `MeetingType[]` list and awaits the pick. `interaction`
 * must already be deferred/replied. Returns the raw resolved interaction —
 * callers differ on what happens next (deferUpdate + continue vs
 * showModal), so that part stays at the call site. Rejects on timeout.
 */
export async function promptMeetingTypeSelect(
  interaction: ChatInputCommandInteraction,
  meetingTypes: MeetingType[],
  opts: PromptMeetingTypeSelectOptions,
): Promise<StringSelectMenuInteraction> {
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(opts.customId)
      .setPlaceholder(opts.placeholder)
      .addOptions(meetingTypes.map((type) => ({ label: type.name, value: type.id }))),
  );

  await interaction.editReply({ content: opts.content, components: [row] });
  const promptMessage = await interaction.fetchReply();

  return promptMessage.awaitMessageComponent({
    filter: (i) => i.customId === opts.customId && i.user.id === interaction.user.id,
    componentType: ComponentType.StringSelect,
    time: opts.timeoutMs,
  });
}
