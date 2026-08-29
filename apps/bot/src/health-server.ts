import { createServer } from "node:http";
import { env } from "./config.js";
import { logger } from "./logger.js";

/**
 * A bare HTTP endpoint with no purpose beyond giving an external uptime
 * pinger (e.g. cron-job.org, UptimeRobot) something to hit. Render's free
 * tier only keeps a "Web Service" alive in response to inbound HTTP
 * requests — the bot's actual job (holding a Discord gateway WebSocket)
 * generates none, so without this the service gets suspended after ~15
 * minutes of no HTTP traffic regardless of how active the bot itself is.
 *
 * This only prevents the *sleep*. It doesn't make the bot itself resilient
 * to a wake cycle — every suspend→wake still drops and reconnects the
 * gateway connection, same as if this server didn't exist. It just makes
 * that cycle rare instead of constant.
 */
export function startHealthServer(): void {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Keep-alive HTTP server listening");
  });
}
