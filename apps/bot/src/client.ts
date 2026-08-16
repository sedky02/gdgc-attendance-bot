import { Client, Collection, GatewayIntentBits, type ChatInputCommandInteraction, type SlashCommandBuilder } from "discord.js";
import * as pingCommand from "./commands/ping.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, Command>([[pingCommand.data.name, pingCommand]]);

export function createClient() {
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers],
  });
}
