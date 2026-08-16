import { REST, Routes } from "discord.js";
import { env } from "./config.js";
import { commands } from "./client.js";
import { logger } from "./logger.js";

const rest = new REST().setToken(env.DISCORD_TOKEN);

const body = [...commands.values()].map((command) => command.data.toJSON());

const route = env.DISCORD_DEV_GUILD_ID
  ? Routes.applicationGuildCommands(env.DISCORD_APPLICATION_ID, env.DISCORD_DEV_GUILD_ID)
  : Routes.applicationCommands(env.DISCORD_APPLICATION_ID);

const scope = env.DISCORD_DEV_GUILD_ID ? `guild ${env.DISCORD_DEV_GUILD_ID}` : "global";

logger.info({ scope, count: body.length }, "Deploying slash commands");
await rest.put(route, { body });
logger.info("Slash commands deployed");
