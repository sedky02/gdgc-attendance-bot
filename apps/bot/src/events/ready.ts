import type { Client } from "discord.js";
import { logger } from "../logger.js";

export function registerReadyEvent(client: Client) {
  client.once("ready", (readyClient) => {
    logger.info({ tag: readyClient.user.tag }, "Bot logged in");
  });
}
