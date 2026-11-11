import type { Server } from "node:http";
import type { Client } from "discord.js";
import { drainEventQueue } from "./services/event-queue.js";
import { stopReconciler } from "./services/reconciler.js";
import { logger } from "./logger.js";

// Short enough to finish inside a container's default 10s stop grace period.
const DRAIN_TIMEOUT_MS = 5000;

/**
 * Delivers the voice events already queued before exiting, so a deploy does
 * not drop them. Anything that still fails is corrected by the next
 * instance's startup reconcile.
 */
export async function shutdown(client: Pick<Client, "destroy">, healthServer: Pick<Server, "close">): Promise<void> {
  stopReconciler();

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, DRAIN_TIMEOUT_MS);
  });
  await Promise.race([drainEventQueue(), timeout]);
  clearTimeout(timer);

  await client.destroy();
  healthServer.close();
}

export function registerGracefulShutdown(client: Client, healthServer: Server): void {
  let shuttingDown = false;

  const handle = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");
    shutdown(client, healthServer)
      .catch((error: unknown) => logger.error({ err: error }, "Shutdown did not complete cleanly"))
      .finally(() => process.exit(0));
  };

  process.once("SIGTERM", handle);
  process.once("SIGINT", handle);
}
