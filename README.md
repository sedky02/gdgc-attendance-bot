# Meeting System

A Discord bot, REST API, and web dashboard for running university club meetings and tracking voice channel attendance automatically.

Start a meeting from a voice channel with a slash command. The system records who was there, when they arrived, how long they stayed, and how many times they came and went. When the meeting ends, it produces an attendance report in Discord and stores the whole thing for the dashboard.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Core principles](#core-principles)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Domain model](#domain-model)
- [The attendance resolver](#the-attendance-resolver)
- [Discord commands](#discord-commands)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Data rules and invariants](#data-rules-and-invariants)
- [Roadmap](#roadmap)

---

## Why this exists

Club leads waste the first ten minutes of every meeting taking attendance, and the record ends up in a spreadsheet nobody maintains. Everyone is already in a Discord voice channel, so the presence data exists. This just captures it.

---

## Core principles

**1. The API owns all business logic.**
The Discord bot receives commands and events, calls the API, and renders the response. It never touches the database. It has no `MONGODB_URI`. If you find yourself writing a Mongoose model inside `apps/bot`, stop — the logic belongs in a service in `apps/api`.

**2. Attendance is a reconciled state, not an event log.**
Voice events are lossy. Bots restart, gateways disconnect, HTTP calls fail. Every active meeting is therefore re-synced against the real voice channel roster every 60 seconds, and on bot startup. Events give precision; sync guarantees correctness. Both go through the same idempotent resolver.

**3. Historical records never change retroactively.**
Usernames, role names, and the expected-member list are snapshotted at write time. A member leaving the club next semester must not alter the attendance record of a meeting held today.

**4. Derived values are computed while live, frozen when complete.**
Duration, lateness, and session counts are calculated on read for `ACTIVE` meetings and written once at `/end-meeting`. This keeps live data correct without making the history page aggregate the entire collection.

---

## Architecture

```text
┌──────────────┐     ┌──────────────┐
│   Discord    │     │   Browser    │
└──────┬───────┘     └──────┬───────┘
       │ gateway            │ HTTPS
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│  Bot         │     │  Dashboard   │
│  discord.js  │     │  Next.js     │
│              │     │              │
│  commands    │     │  Auth.js     │
│  events      │     │  TanStack    │
│  reconciler  │     │  Query       │
└──────┬───────┘     └──────┬───────┘
       │                    │
       │ service token      │ user JWT
       └────────┬───────────┘
                ▼
       ┌─────────────────┐
       │   NestJS API    │
       │                 │
       │  auth           │
       │  meeting-types  │
       │  meetings       │
       │  attendance ◄── resolver + stats
       │  reports        │
       │  sweeper (cron) │
       └────────┬────────┘
                ▼
          ┌───────────┐
          │  MongoDB  │
          └───────────┘
```

Both clients speak to the same API with the same contracts. The bot authenticates with a static service token and passes the acting Discord user ID for attribution; the dashboard authenticates with a JWT minted after verifying Discord guild membership.

### Event flow

```text
User joins voice channel
        │
        ▼
voiceStateUpdate fires
        │
        ├─ ignore if: bot user, or channelId unchanged (mute/deafen/video)
        │
        ▼
Bot queues event with occurredAt timestamp
        │
        ▼
POST /internal/voice-events   (retries with backoff)
        │
        ▼
API resolves target meeting by (guildId, channelId, status ACTIVE)
        │
        ▼
Attendance resolver: open session if none open
```

Running in parallel, every 60 seconds per active meeting:

```text
Bot reads channel.members
        │
        ▼
POST /meetings/:id/attendance/sync  { presentUserIds, observedAt }
        │
        ▼
Resolver diffs: open sessions for newcomers, close sessions for absentees
```

Both paths converge on the same resolver, and the resolver is idempotent. A duplicated event is a no-op; a dropped event self-corrects within a minute.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Three apps sharing one contracts package |
| API | NestJS 10, TypeScript | Modular, DI, first-class testing |
| Database | MongoDB + Mongoose | Partial unique indexes enforce the key invariants |
| Bot | discord.js v14 | Long-running process, gateway intents required |
| Dashboard | Next.js 14+ App Router | Server components for lists, client for live views |
| UI | Tailwind + shadcn/ui | |
| Data fetching | TanStack Query | Polling for live meetings comes almost free |
| Validation | Zod, shared via `packages/contracts` | One schema drives API DTOs and dashboard forms |
| API docs | `@nestjs/swagger` + `zod-to-json-schema` | OpenAPI generated from the same Zod schemas, no class DTOs |
| Auth | Auth.js (Discord provider) + JWT; service token for the bot | |
| Scheduling | `@nestjs/schedule` | Stale-meeting sweeper. No Redis in the MVP |
| Logging | pino, with `meetingId` correlation | |
| Testing | Vitest + `mongodb-memory-server` | The resolver is a state machine and must be unit tested |
| Local infra | Docker Compose | Mongo + mongo-express |

Redis is deliberately absent. Nothing here needs a queue or a cache yet. Revisit if the bot is sharded across processes or reminders are added.

---

## Domain model

Three collections. A fourth (`MeetingReport`) was considered and dropped — the summary lives on the meeting.

```text
MeetingType  1 ──── N  Meeting  1 ──── N  Attendance  ──── embedded  Session[]
```

### MeetingType

Reusable configuration. Defines what kind of meeting this is and which Discord roles are expected to attend.

```ts
{
  _id: ObjectId,
  guildId: string,
  name: string,                    // "Weekly Technical Meeting"
  roles: [{
    roleId: string,                // canonical
    nameSnapshot: string           // display only, refreshed on edit
  }],
  createdBy: string,               // discord user id
  archived: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

Roles are stored by ID, not name. Renaming a role in Discord must not silently break the type.

### Meeting

One actual occurrence. It has no title of its own — the name comes from its `MeetingType`.

```ts
{
  _id: ObjectId,
  guildId: string,
  meetingType: ObjectId,
  voiceChannelIds: string[],       // usually one, array supports breakouts
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED',

  startedBy: string,
  startedAt: Date,
  endedBy: string | null,          // discord user id, or 'SYSTEM'
  endedAt: Date | null,
  cancelReason: string | null,

  pauses: [{ pausedAt: Date, resumedAt: Date | null }],

  // snapshot written once at start, never mutated
  expectedMembers: [{
    discordUserId: string,
    usernameSnapshot: string,
    roleIds: string[]
  }],

  summary: string | null,
  summaryUpdatedBy: string | null,
  summaryUpdatedAt: Date | null,

  // frozen at /end-meeting only
  stats: {
    presentCount: number,
    expectedCount: number,
    unexpectedCount: number,
    durationMs: number
  } | null,

  createdAt: Date
}
```

`expectedMembers` is the fix for a subtle bug: if absentees are computed by comparing current role membership against attendance, then every historical meeting silently rewrites itself as people join and leave the club. Snapshotting costs nothing and makes the record permanent.

### Attendance

One document per user per meeting. Created lazily — only for people who actually show up.

```ts
{
  _id: ObjectId,
  meeting: ObjectId,
  discordUserId: string,           // canonical identifier
  usernameSnapshot: string,
  displayNameSnapshot: string,
  expected: boolean,               // false = attended without a matching role

  sessions: [{
    joinedAt: Date,
    leftAt: Date | null,
    source: 'EVENT' | 'SYNC' | 'MANUAL'
  }],

  manuallyEdited: boolean,
  editedBy: string | null,

  // frozen at /end-meeting
  stats: {
    firstJoinedAt: Date,
    latenessMs: number,
    totalDurationMs: number,
    sessionCount: number
  } | null
}
```

`source` on each session is worth having. When a session was reconstructed by the 60-second sync rather than observed directly, its boundary can be off by up to a minute — and when you are debugging an odd record six weeks later, knowing which path wrote it saves an hour.

### Indexes

```ts
// at most one live meeting per channel, enforced by the database
MeetingSchema.index(
  { guildId: 1, voiceChannelIds: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['ACTIVE', 'PAUSED'] } } }
);

// at most one attendance doc per user per meeting
AttendanceSchema.index({ meeting: 1, discordUserId: 1 }, { unique: true });

// history queries
MeetingSchema.index({ guildId: 1, status: 1, startedAt: -1 });
MeetingTypeSchema.index({ guildId: 1, archived: 1 });
```

Invariants belong in the database. Application-level "check then write" loses to concurrency every time.

---

## The attendance resolver

The single component that mutates sessions. Everything else calls it.

```ts
resolvePresence(meetingId, {
  presentUserIds: string[],   // full roster, or a single user for an event
  observedAt: Date,
  scope: 'FULL' | 'PARTIAL',  // FULL closes sessions for anyone absent
  source: 'EVENT' | 'SYNC'
})
```

Rules:

- **Timestamps come from the caller**, never `Date.now()` inside the API. A retried request must not shift the record.
- **Opening is conditional.** If the user already has an open session, do nothing. Implemented as a single atomic `findOneAndUpdate` with upsert, not read-then-write.
- **Closing only applies with `scope: 'FULL'`.** A join event tells you one person arrived; it says nothing about anyone else.
- **`PAUSED` meetings ignore everything.** No sessions open or close while paused.
- **Late-arriving `observedAt` is discarded** if it predates the session's `joinedAt`.

The pause and resume semantics matter: pausing closes every open session, resuming re-opens sessions for whoever is currently in the channel. This prevents one session from spanning a pause and inflating durations.

### Lifecycle state machine

```text
                  /start-meeting
                        │
                        ▼
    ┌───── /pause ─── ACTIVE ─── /end ────► COMPLETED
    │                  ▲  │
    ▼                  │  └──── /cancel ──► CANCELLED
 PAUSED ── /resume ────┘  │
    │                     └──── sweeper ──► COMPLETED (endedBy: SYSTEM)
    └──── /cancel ─────────────────────────► CANCELLED
```

The sweeper runs every 5 minutes and auto-ends any meeting whose channels have been empty for more than 15 minutes, backdating `endedAt` to the last observed departure. It also hard-caps meetings at 12 hours. Without it, one forgotten `/start-meeting` permanently blocks that channel via the uniqueness index.

---

## Discord commands

| Command | Who | What it does |
|---|---|---|
| `/configure-meeting` | manager | Creates a MeetingType. Modal for the name, native role select for roles. |
| `/edit-meeting-type` | manager | Edits name and roles. Affects future meetings only. |
| `/start-meeting` | manager | Detects your current voice channel, prompts for a type, snapshots expected members, opens sessions for whoever is already present. |
| `/pause-meeting` | manager | `ACTIVE → PAUSED`. Closes all open sessions. |
| `/resume-meeting` | manager | `PAUSED → ACTIVE`. Re-opens sessions for current occupants. |
| `/end-meeting` | manager | Closes sessions, freezes stats, posts the attendance report. |
| `/cancel-meeting` | manager | Closes sessions, marks `CANCELLED`, no report. Record is kept. |
| `/meeting-status` | anyone | Who is currently in the live meeting. |

Manager access is gated with `setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)`, overridable per guild.

Use Discord's native components rather than parsing free text: `RoleSelectMenuBuilder` for role configuration, `StringSelectMenu` for choosing a meeting type. This also removes any chance of a role-name typo.

### Report output

```text
Weekly Technical Meeting
16 Aug 2026 · 19:00 → 20:35 (1h35)

Present  8/10

Aymen     19:02 → 20:35   1h33   (2 sessions)
Sami      19:00 → 20:10   1h10
Ali       19:17 → 20:35   1h18   late 17m
Ahmed     absent
```

---

## API reference

All routes are prefixed `/api/v1`. Every route is scoped to a guild.

Interactive docs are served at **`/docs`**, with the raw OpenAPI 3 document at **`/docs/openapi.json`**. Both sit outside the version prefix, alongside `/health`. They are on by default and off when `NODE_ENV=production`, unless `SWAGGER_ENABLED` says otherwise.

The request and response schemas are generated from the Zod schemas in `packages/contracts` at boot — there are no hand-written class DTOs to drift out of sync. Adding a contract to `apps/api/src/openapi/contract-schemas.ts` is what makes it referenceable from a route.

### Meeting types

```
GET    /meeting-types?guildId=
POST   /meeting-types
GET    /meeting-types/:id
PATCH  /meeting-types/:id
DELETE /meeting-types/:id        # soft delete → archived: true
```

### Meetings

```
POST   /meetings                 # start
GET    /meetings?guildId=&status=&page=
GET    /meetings/active?guildId=
GET    /meetings/:id
POST   /meetings/:id/pause
POST   /meetings/:id/resume
POST   /meetings/:id/end
POST   /meetings/:id/cancel
PATCH  /meetings/:id/summary
GET    /meetings/:id/report
```

### Attendance

```
GET    /meetings/:id/attendance
POST   /meetings/:id/attendance/sync      # full roster reconciliation
POST   /meetings/:id/attendance/manual    # lead correction, sets source MANUAL
PATCH  /attendance/:id                    # edit a session, audited
```

### Internal (service token only)

```
POST   /internal/voice-events             # { guildId, userId, from, to, occurredAt }
POST   /internal/bootstrap                # bot startup: list active meetings to reconcile
```

Deleting a meeting is intentionally absent. Cancelled and completed meetings stay in the database.

---

## Project structure

```text
meeting-system/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── config/                  # zod-validated env, mongoose setup
│   │       ├── common/
│   │       │   ├── guards/              # ServiceTokenGuard, JwtGuard, GuildRoleGuard
│   │       │   ├── decorators/          # @CurrentUser, @ServiceOnly
│   │       │   ├── filters/
│   │       │   └── pipes/               # ZodValidationPipe
│   │       ├── auth/
│   │       ├── meeting-types/
│   │       │   ├── schemas/
│   │       │   ├── meeting-types.service.ts
│   │       │   ├── meeting-types.controller.ts
│   │       │   └── meeting-types.module.ts
│   │       ├── meetings/
│   │       │   ├── schemas/
│   │       │   ├── meetings.service.ts
│   │       │   ├── meeting-lifecycle.service.ts
│   │       │   ├── meeting-sweeper.service.ts
│   │       │   ├── meetings.controller.ts
│   │       │   └── meetings.module.ts
│   │       ├── attendance/
│   │       │   ├── schemas/
│   │       │   ├── attendance-resolver.service.ts    # the core
│   │       │   ├── attendance-stats.service.ts
│   │       │   ├── attendance.service.ts
│   │       │   ├── attendance.controller.ts
│   │       │   └── attendance.module.ts
│   │       ├── reports/
│   │       └── internal/                # endpoints the bot calls
│   │
│   ├── bot/
│   │   └── src/
│   │       ├── index.ts
│   │       ├── client.ts
│   │       ├── deploy-commands.ts
│   │       ├── commands/                # one folder per command
│   │       │   ├── configure-meeting/{index.ts,constants.ts}
│   │       │   ├── edit-meeting-type/{index.ts,constants.ts}
│   │       │   ├── start-meeting/{index.ts,constants.ts}
│   │       │   ├── pause-meeting/index.ts
│   │       │   ├── resume-meeting/index.ts
│   │       │   ├── end-meeting/index.ts
│   │       │   ├── cancel-meeting/{index.ts,constants.ts}
│   │       │   ├── meeting-status/index.ts
│   │       │   └── ping/index.ts
│   │       ├── events/
│   │       │   ├── ready.ts
│   │       │   ├── interaction-create.ts
│   │       │   └── voice-state-update.ts
│   │       ├── services/
│   │       │   ├── api-client.ts        # thin facade over services/api/
│   │       │   ├── api/                 # per-resource clients + shared http-client
│   │       │   ├── reconciler.ts        # 60s roster sync
│   │       │   └── event-queue.ts       # bounded, ordered per user
│   │       ├── validation/
│   │       │   └── guards.ts            # shared precondition-reply helpers
│   │       ├── ui/
│   │       │   ├── embeds/
│   │       │   ├── modals/              # shared single-field modal builder
│   │       │   ├── selects/             # shared select-menu prompts
│   │       │   ├── constants.ts         # shared UI timeouts
│   │       │   └── reply-error.ts       # shared error-reply helper
│   │       └── utils/
│   │
│   └── dashboard/
│       ├── app/
│       │   ├── (auth)/login/
│       │   ├── (app)/
│       │   │   ├── page.tsx                     # overview
│       │   │   ├── meetings/page.tsx
│       │   │   ├── meetings/[id]/page.tsx
│       │   │   └── meeting-types/page.tsx
│       │   └── api/auth/[...nextauth]/
│       ├── components/{ui,meetings,attendance}/
│       ├── lib/{api.ts,queries/}
│       └── types/
│
├── packages/
│   ├── contracts/          # zod schemas, inferred types, enums — shared by all three
│   ├── eslint-config/
│   └── tsconfig/
│
├── infra/
│   ├── docker-compose.yml
│   └── Dockerfile.{api,bot,dashboard}
│
├── docs/
│   └── BUILD_PLAN.md
├── CLAUDE.md
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

Note what `apps/bot` does not contain: a `models/` directory or a database connection.

---

## Getting started

Requires Node 20+, pnpm 9+, Docker, and a Discord application.

```bash
git clone <repo-url> && cd meeting-system
pnpm install

docker compose -f infra/docker-compose.yml up -d      # mongo on :27017

cp apps/api/.env.example apps/api/.env
cp apps/bot/.env.example apps/bot/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
# fill in the values below

pnpm --filter bot deploy-commands                      # register slash commands
pnpm dev                                               # turbo runs all three
```

API on `:3001`, dashboard on `:3000`, bot connects to the gateway.

### Discord setup

Create an application at the Discord Developer Portal. Under **Bot**, enable:

- Server Members Intent
- Message Content Intent is **not** needed

Required gateway intents in code: `Guilds`, `GuildVoiceStates`, `GuildMembers`.

Invite with scopes `bot` and `applications.commands`, and permissions: View Channels, Send Messages, Use Slash Commands, Connect (to read voice state), Embed Links.

Under **OAuth2**, add `http://localhost:3000/api/auth/callback/discord` as a redirect for the dashboard.

---

## Environment variables

**`apps/api/.env`**

```bash
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://root:root@localhost:27017/meetings?authSource=admin
JWT_SECRET=                  # openssl rand -base64 32
BOT_SERVICE_TOKEN=           # openssl rand -hex 32, must match the bot
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
CORS_ORIGIN=http://localhost:3000
SWAGGER_ENABLED=             # "true" or "false"; defaults to true unless NODE_ENV=production
```

**`apps/bot/.env`** — note the absence of a database URI

```bash
DISCORD_TOKEN=
DISCORD_APPLICATION_ID=
DISCORD_DEV_GUILD_ID=        # instant command registration during development
API_BASE_URL=http://localhost:3001/api/v1
BOT_SERVICE_TOKEN=           # matches the API
RECONCILE_INTERVAL_MS=60000
```

**`apps/dashboard/.env.local`**

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

## Development

```bash
pnpm dev                     # all apps via turbo
pnpm --filter api dev
pnpm --filter bot dev
pnpm --filter dashboard dev

pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:watch

pnpm --filter bot deploy-commands       # after changing any command definition
```

Register commands to `DISCORD_DEV_GUILD_ID` in development — guild commands appear instantly, global ones can take an hour to propagate.

---

## Testing

The resolver is where correctness lives, so it gets the most coverage. Use `mongodb-memory-server` so tests exercise the real indexes.

Scenarios that must be covered:

- Join then leave produces one closed session
- Duplicate join events produce one session, not two
- Mute, deafen, and video toggles produce no sessions at all
- Channel move out of a meeting closes the session
- Channel move between two active meetings closes one and opens the other
- Pause closes every open session; resume opens new ones for current occupants
- A session never spans a pause
- Sync closes sessions for users who vanished during an outage
- Sync opens sessions for users who arrived during an outage
- A replayed sync with an older `observedAt` changes nothing
- Two concurrent joins for the same user create one attendance document
- Two concurrent `/start-meeting` calls on one channel: one succeeds, one gets a clean 409
- The sweeper ends an abandoned meeting and backdates `endedAt` correctly
- Lateness is measured from `startedAt` to the first join
- Total duration excludes paused intervals

You cannot reproduce "the bot crashed at 19:37" by hand, repeatedly, at 2am. Write the test.

---

## Deployment

The bot and API are long-running processes and cannot go on Vercel — the bot holds a persistent Discord gateway connection, and the API runs an in-process cron (`MeetingSweeperService`) that needs a continuously-running process, not a serverless function that spins down between requests.

| Component | Target |
|---|---|
| API | Any Docker host with an always-on process — this repo's `infra/` targets a single VM (e.g. a cloud "Always Free" tier) |
| Bot | Same host as the API, single instance |
| Dashboard | Vercel |
| Database | MongoDB Atlas free tier |

`infra/Dockerfile.api` and `infra/Dockerfile.bot` build each app via the standard Turborepo-prune pattern (`turbo prune --docker` extracts just the source and package.json files that app needs, including `packages/contracts`). `infra/docker-compose.prod.yml` runs both, plus a Caddy reverse proxy that gets the API a free automatic TLS certificate — required because the dashboard's client-side mutation components call the API directly from the browser, so once the dashboard is on HTTPS (Vercel), the API must be too or the browser blocks it as mixed content.

**One-time setup on the VM:**

```bash
git clone <repo-url> && cd meeting-system
cp infra/.env.example infra/.env               # API_DOMAIN=api.yourdomain.com
cp infra/.env.api.example infra/.env.api       # fill in production secrets
cp infra/.env.bot.example infra/.env.bot       # fill in production secrets
docker compose -f infra/docker-compose.prod.yml up -d --build
```

`JWT_SECRET` (API) must equal the dashboard's `API_JWT_SECRET` (Vercel); `BOT_SERVICE_TOKEN` must be identical in `.env.api` and `.env.bot`. Deploy the dashboard to Vercel separately (root directory `apps/dashboard`), with `NEXT_PUBLIC_API_URL` pointing at `https://<API_DOMAIN>/api/v1` — Next.js inlines this at build time, so set it before the first deploy.

After the API is reachable, register commands globally (not scoped to `DISCORD_DEV_GUILD_ID`):

```bash
pnpm --filter bot deploy-commands
```

Run exactly one bot instance — never scale the `bot` service beyond 1 replica. Two instances mean duplicate events and two reconcilers fighting each other. Sharding is not needed below 2,500 guilds and would require moving the reconciler behind a lock.

Before going live: set a strong `BOT_SERVICE_TOKEN`, restrict `CORS_ORIGIN` to the dashboard's real domain, enable Atlas IP allowlisting, and confirm `SWAGGER_ENABLED` is set the way you want it (defaults off when `NODE_ENV=production`).

---

## Data rules and invariants

1. A voice channel has at most one `ACTIVE` or `PAUSED` meeting. Enforced by a partial unique index.
2. A user has at most one `Attendance` document per meeting. Enforced by a compound unique index.
3. An `Attendance` has at most one session with `leftAt: null`. Enforced by the resolver.
4. Timestamps always come from the observing client, never from server processing time.
5. Usernames and role names are snapshots. Discord IDs are canonical.
6. Meetings are never deleted, including cancelled ones.
7. Derived values are computed on read while live, and written once on completion.
8. `expectedMembers` is written at start and never mutated.
9. Manual edits set `manuallyEdited: true` and record the editor.
10. Bot users are excluded from attendance entirely.

---

## Roadmap

Deliberately out of the MVP:

- AI summaries, transcription, action items
- Scheduling and reminders
- Attendance requirements, quotas, or scoring
- Cross-semester analytics and per-member trends
- CSV and PDF export
- Multi-guild management UI
- Redis, queues, sharding

Each can be added without changing the attendance model, which is the point of getting that model right first.

---

## License

MIT
