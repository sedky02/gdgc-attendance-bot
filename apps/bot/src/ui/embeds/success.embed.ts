import { EmbedBuilder } from "discord.js";

export function successEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x57f287).setTitle(title).setDescription(description ?? null);
}
