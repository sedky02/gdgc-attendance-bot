# Deployment

The bot and API are long-running processes and cannot run on a serverless platform: the bot holds a persistent Discord gateway connection, and the API runs an in-process cron (`MeetingSweeperService`).

| Component | Target |
|---|---|
| API | Render web service, built from `infra/Dockerfile.api` |
| Bot | Render web service, built from `infra/Dockerfile.bot`, exactly one instance |
| Dashboard | Vercel (root directory `apps/dashboard`) |
| Database | MongoDB Atlas |

A single VM running `infra/docker-compose.prod.yml` is a supported alternative, described [below](#alternative-a-single-vm-with-docker-compose).

Both images are multi-stage builds using the Turborepo prune pattern (`turbo prune --docker` extracts only the source and manifests one app needs, including `packages/contracts`). They run as a non-root user and define a `HEALTHCHECK`. The build context is the repository root.

## Render

Create two web services with the Docker runtime, both pointing at this repository with the repository root as the build context:

| Service | Dockerfile | Health check path | Environment |
|---|---|---|---|
| API | `infra/Dockerfile.api` | `/health` | the variables in `infra/.env.api.example` |
| Bot | `infra/Dockerfile.bot` | `/` | the variables in `infra/.env.bot.example` |

Render terminates TLS and routes traffic to the container, so no reverse proxy is needed. It injects `PORT`, which both processes honour. The bot serves a bare HTTP endpoint on that port only so Render has something to route to and so the service can be woken; it handles no other inbound traffic.

Shared secrets must agree across services:

- `BOT_SERVICE_TOKEN` is identical on the API and the bot.
- `JWT_SECRET` on the API equals `API_JWT_SECRET` on the dashboard.
- `DISCORD_BOT_TOKEN` on the dashboard is the same token as the bot's `DISCORD_TOKEN`; the dashboard uses it to list which guilds the bot is installed in.
- `NEXT_PUBLIC_API_URL` on the dashboard points at `https://<api host>/api/v1`. Next.js inlines it at build time, so set it before the first Vercel deploy.

After the API is reachable, register the slash commands globally (leave `DISCORD_DEV_GUILD_ID` unset):

```bash
pnpm --filter bot deploy-commands
```

Run exactly one bot instance. Two instances mean duplicate events and two reconcilers fighting each other. Sharding is not needed below 2,500 guilds and would require moving the reconciler behind a lock.

### Staying inside Render's free tier

Render's free tier gives 750 instance hours a month and suspends a web service after ~15 minutes with no inbound HTTP traffic. The bot's work is a Discord gateway WebSocket, which generates none, and a suspended bot can't receive slash commands or voice events. Three layers keep it awake only when needed:

1. **Wake button (primary).** In the signed-in dashboard, press **Wake bot** in the sidebar or in the **Bot status** card on the Overview page (the card also appears on the error screen, since a sleeping API makes Overview fail to load). It pings the bot and API via `/api/wake` (using `BOT_HEALTH_URL` / `API_HEALTH_URL` on Vercel; session required) and shows when both are online, usually 30–60 s. Then run `/start-meeting`. Status is never checked on page load, because any request to a sleeping service wakes it. Repeated pings are coalesced into one upstream call per 5 seconds.
2. **API keep-alive.** While any meeting is `ACTIVE` or `PAUSED`, `MeetingKeepAliveService` pings `BOT_HEALTH_URL` and `API_PUBLIC_URL` every 10 minutes (the API pings itself, or it could sleep and stop pinging the bot). With no live meeting it does nothing, so both services sleep ~15 minutes after the last meeting ends. This covers meetings that run past any external window.
3. **Optional safety-net window.** In cron-job.org (or UptimeRobot) create one job hitting the bot URL every 10 minutes, scheduled 18:00–00:00 in your local timezone (set the job's timezone; Render runs UTC). That is ~186 h/month per service, ~372 h total, within the 750 budget. Drop it if hours get tight; layers 1 and 2 still work.

Nothing can wake a suspended service except an HTTP request, so a meeting started without layer 1 or 3 having run first will fail until the bot is up.

## Upgrading an existing database

Attendance records now carry a `guildId`. Records written by earlier versions do not have it; the API still resolves their guild through the parent meeting, so nothing breaks, but run the backfill once after deploying:

```bash
MONGODB_URI=<production uri> pnpm --filter api backfill:attendance-guild-id
```

It only touches records that are missing the field, so it is safe to re-run and safe to run while the API is serving traffic. Take an Atlas snapshot first.

The dashboard's API tokens now carry a `canManage` claim. Anyone signed in before the upgrade is read-only until they sign out and back in.

## Alternative: a single VM with Docker Compose

`infra/docker-compose.prod.yml` runs the API, the bot, and a Caddy reverse proxy that obtains a TLS certificate for the API automatically. TLS is required because the dashboard's client components call the API from the browser, and a browser on an HTTPS page blocks plain-HTTP requests. The bot and Caddy wait for the API's healthcheck before starting.

```bash
git clone https://github.com/sedky02/gdgc-attendance-bot.git && cd gdgc-attendance-bot
cp infra/.env.example infra/.env               # API_DOMAIN=api.yourdomain.com
cp infra/.env.api.example infra/.env.api       # fill in production secrets
cp infra/.env.bot.example infra/.env.bot       # fill in production secrets
docker compose -f infra/docker-compose.prod.yml up -d --build
```

## Before going live

- Generate strong values for `BOT_SERVICE_TOKEN` and `JWT_SECRET` (`openssl rand -hex 32`).
- Restrict `CORS_ORIGIN` to the dashboard's real origin.
- Enable Atlas IP allowlisting.
- Leave `DEMO_MODE` unset on the dashboard. It is ignored in production builds regardless.
- Confirm `SWAGGER_ENABLED` is what you want; it defaults to off when `NODE_ENV=production`.
