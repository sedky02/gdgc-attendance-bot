import { Client, Collection, GatewayIntentBits, type ChatInputCommandInteraction, type SlashCommandBuilder } from "discord.js";
import * as pingCommand from "./commands/ping/index.js";
import * as configureMeetingCommand from "./commands/configure-meeting/index.js";
import * as editMeetingTypeCommand from "./commands/edit-meeting-type/index.js";
import * as startMeetingCommand from "./commands/start-meeting/index.js";
import * as pauseMeetingCommand from "./commands/pause-meeting/index.js";
import * as resumeMeetingCommand from "./commands/resume-meeting/index.js";
import * as endMeetingCommand from "./commands/end-meeting/index.js";
import * as cancelMeetingCommand from "./commands/cancel-meeting/index.js";
import * as meetingStatusCommand from "./commands/meeting-status/index.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, Command>(
  [
    pingCommand,
    configureMeetingCommand,
    editMeetingTypeCommand,
    startMeetingCommand,
    pauseMeetingCommand,
    resumeMeetingCommand,
    endMeetingCommand,
    cancelMeetingCommand,
    meetingStatusCommand,
  ].map((command) => [command.data.name, command]),
);

export function createClient() {
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers],
  });
}
