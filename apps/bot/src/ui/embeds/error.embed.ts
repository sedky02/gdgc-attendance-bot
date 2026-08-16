import { EmbedBuilder } from "discord.js";

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xed4245).setTitle("Something went wrong").setDescription(message);
}
