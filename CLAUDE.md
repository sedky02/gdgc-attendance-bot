# CLAUDE.md

Context for Claude Code working in this repository. Read this before making changes.

---

## What this is

A Discord bot + NestJS API + Next.js dashboard for tracking voice channel attendance at university club meetings. pnpm workspace monorepo managed by Turborepo.

Full spec: `README.md`. Phased task list: `docs/BUILD_PLAN.md`.

---

## Non-negotiable rules

These are architectural constraints, not preferences. Violating them is a bug even if the code works.

**1. The bot never touches the database.**
`apps/bot` has no `mongoose` dependency, no `MONGODB_URI`, and no `models/` directory. If a command needs data, it calls the API. If the API lacks the endpoint, add the endpoint — do not shortcut through Mongo.

**2. All shared types live in `packages/contracts` as Zod schemas.**
Never hand-write a duplicate interface in `apps/api`, `apps/bot`, or `apps/dashboard`. Define the Zod schema once, export the inferred type, import it everywhere. If you catch yourself typing `interface Meeting {` outside `packages/contracts`, stop.

**3. Timestamps come from the caller.**
Never call `new Date()` inside `attendance-resolver.service.ts`. Every mutation takes an explicit `observedAt` supplied by whoever observed the event. Retries must not shift records.

**4. Only the resolver mutates sessions.**
`attendance-resolver.service.ts` is the single writer for `Attendance.sessions`. Controllers, commands, and other services call it. No other file writes to that array.

**5. Session writes are atomic.**
Use a single `findOneAndUpdate` with a filter that expresses the precondition. Never `findOne` then `save` — concurrent voice events will produce duplicate sessions.

**6. Invariants live in the database.**
Uniqueness is enforced by indexes, not by application-level checks. Catch the duplicate-key error (11000) and translate it to a clean HTTP 409.

**7. Snapshot, never join, for historical display.**
Usernames, display names, role names, and expected members are copied at write time. Discord IDs are the only canonical references.

---

## Commands

```bash
pnpm install
pnpm dev                                  # all apps
pnpm --filter api dev
pnpm --filter bot dev
pnpm --filter dashboard dev
pnpm --filter bot deploy-commands         # after editing any slash command definition
pnpm test
pnpm test --filter api
pnpm lint
pnpm typecheck
pnpm build
docker compose -f infra/docker-compose.yml up -d
```

Always run `pnpm typecheck && pnpm test` before declaring a phase complete.

---

## Conventions

**Files** — kebab-case: `attendance-resolver.service.ts`, `start-meeting.ts`.
**Nest modules** — one folder per domain, containing `schemas/`, `*.service.ts`, `*.controller.ts`, `*.module.ts`.
**Discord IDs** — always `string`, never `number`. Snowflakes exceed `Number.MAX_SAFE_INTEGER`.
**Durations** — always milliseconds, always suffixed `Ms`: `totalDurationMs`, `latenessMs`.
**Dates** — always UTC `Date` objects. Format for display only in the bot's embed builders and the dashboard.
**Errors** — throw Nest's typed exceptions (`ConflictException`, `NotFoundException`). The bot renders `error.message` back to the user, so messages must be human-readable.
**Logging** — pino, with `meetingId` and `discordUserId` in the context object on every attendance-related log line.

---

## Testing expectations

Any change to `attendance-resolver.service.ts`, `meeting-lifecycle.service.ts`, or `meeting-sweeper.service.ts` requires tests. Use `mongodb-memory-server` so real indexes are exercised.

The scenario list in `README.md` under "Testing" is the minimum bar. Add to it; do not remove from it.

Do not mock Mongoose. Mocked repositories hide exactly the concurrency and index bugs this system is most likely to have.

---

## Working style

- Work one phase at a time. Do not start Phase N+1 before Phase N's checkpoint passes.
- When a task is ambiguous, ask rather than guessing at the domain model. Getting the schema wrong is expensive; a clarifying question is cheap.
- Prefer editing existing files over creating parallel ones.
- Do not add dependencies without saying why. Especially not Redis, a queue library, an ORM, or a state manager.
- Do not add `README` files to subdirectories. Documentation lives in `README.md`, `CLAUDE.md`, and `docs/`.
- Small commits, conventional format: `feat(attendance): close sessions on pause`.

---

## Known traps

- `voiceStateUpdate` fires for mute, deafen, self-video, streaming, and suppress. Compare `oldState.channelId !== newState.channelId` before doing anything.
- Bot accounts join voice channels too. Filter `member.user.bot`.
- The server AFK channel counts as leaving, not as being present.
- A channel move is one event with both `from` and `to`. Do not split it into a leave call and a join call — they can arrive out of order.
- `guildId` belongs on every collection. Adding it later means a migration and touching every query.
- Roles must be stored by ID. Role names change.
- Guild slash commands register instantly; global ones take up to an hour. Use `DISCORD_DEV_GUILD_ID` in development.
- Discord's member cache is often empty. Use `guild.members.fetch()` when snapshotting expected members.
- Exactly one bot instance may run at a time. Two means duplicate events and duelling reconcilers.
