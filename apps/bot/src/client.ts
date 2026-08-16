import { Client, Collection, GatewayIntentBits, type ChatInputCommandInteraction, type SlashCommandBuilder } from "discord.js";
import * as pingCommand from "./commands/ping.js";
import * as configureMeetingCommand from "./commands/configure-meeting.js";
import * as editMeetingTypeCommand from "./commands/edit-meeting-type.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, Command>(
  [pingCommand, configureMeetingCommand, editMeetingTypeCommand].map((command) => [command.data.name, command]),
);

export function createClient() {
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers],
  });
}
