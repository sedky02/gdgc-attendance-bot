import { env } from "./config.js";
import { createClient } from "./client.js";
import { registerReadyEvent } from "./events/ready.js";
import { registerInteractionCreateEvent } from "./events/interaction-create.js";
import { registerVoiceStateUpdateEvent } from "./events/voice-state-update.js";
import { initReconciler, bootstrap } from "./services/reconciler.js";
import { logger } from "./logger.js";

const client = createClient();

initReconciler(client);
registerReadyEvent(client);
registerInteractionCreateEvent(client);
registerVoiceStateUpdateEvent(client);

// A restart loses all in-memory tracking — bootstrap rediscovers whichever
// meetings are still live and reconciles them immediately, rather than
// waiting for someone to notice the record has drifted.
client.once("ready", () => {
  bootstrap().catch((error: unknown) => logger.error({ err: error }, "Startup bootstrap failed"));
});

// A dropped and resumed gateway session can miss voice events entirely —
// the same rediscovery applies here.
client.on("shardResume", () => {
  bootstrap().catch((error: unknown) => logger.error({ err: error }, "Post-resume bootstrap failed"));
});

client.login(env.DISCORD_TOKEN);
