import {
  ActionRowBuilder,
  ComponentType,
  MessageFlags,
  RoleSelectMenuBuilder,
  type RepliableInteraction,
  type RoleSelectMenuInteraction,
} from "discord.js";

interface PromptRoleSelectOptions {
  customId: string;
  content: string;
  placeholder: string;
  minValues?: number;
  maxValues?: number;
  /** Omit entirely to leave the menu with no pre-selected roles — passing
   * `[]` explicitly still calls `setDefaultRoles([])`, which is not quite
   * the same payload as never calling it. */
  defaultRoleIds?: string[];
  timeoutMs: number;
}

/**
 * Sends a role-select-menu prompt and awaits the pick, scoped to the user
 * who triggered `interaction`. Returns the raw resolved interaction — the
 * caller still does its own `.roles.values()` → API call → `.update()`,
 * since those differ per command. Rejects on timeout.
 */
export async function promptRoleSelect(
  interaction: RepliableInteraction,
  opts: PromptRoleSelectOptions,
): Promise<RoleSelectMenuInteraction> {
  const builder = new RoleSelectMenuBuilder()
    .setCustomId(opts.customId)
    .setPlaceholder(opts.placeholder)
    .setMinValues(opts.minValues ?? 1)
    .setMaxValues(opts.maxValues ?? 25);

  if (opts.defaultRoleIds !== undefined) {
    builder.setDefaultRoles(opts.defaultRoleIds);
  }

  const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(builder);

  await interaction.reply({ content: opts.content, components: [row], flags: MessageFlags.Ephemeral });
  const promptMessage = await interaction.fetchReply();

  return promptMessage.awaitMessageComponent({
    filter: (i) => i.customId === opts.customId && i.user.id === interaction.user.id,
    componentType: ComponentType.RoleSelect,
    time: opts.timeoutMs,
  });
}
