import { env } from "./config.js";
import { createClient } from "./client.js";
import { registerReadyEvent } from "./events/ready.js";
import { registerInteractionCreateEvent } from "./events/interaction-create.js";
import { initMeetingHeartbeat } from "./services/meeting-heartbeat.js";

const client = createClient();

initMeetingHeartbeat(client);
registerReadyEvent(client);
registerInteractionCreateEvent(client);

client.login(env.DISCORD_TOKEN);
