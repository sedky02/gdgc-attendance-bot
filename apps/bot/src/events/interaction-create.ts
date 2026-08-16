import type { Client } from "discord.js";
import { commands } from "../client.js";
import { logger } from "../logger.js";

export function registerInteractionCreateEvent(client: Client) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error({ err: error, command: interaction.commandName }, "Command execution failed");
      const errorMessage = error instanceof Error ? error.message : "Something went wrong.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  });
}
