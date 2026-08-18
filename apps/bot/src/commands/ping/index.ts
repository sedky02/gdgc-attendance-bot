import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { apiClient } from "../../services/api-client.js";

export const data = new SlashCommandBuilder().setName("ping").setDescription("Checks that the API is reachable");

export async function execute(interaction: ChatInputCommandInteraction) {
  const { message, timestamp } = await apiClient.ping();
  await interaction.reply(`${message} — API responded at ${timestamp.toISOString()}`);
}
