# Build plan

Eight phases. Each has a goal, a task list, and a checkpoint that must pass before moving on.

Work through them in order. The ordering is not arbitrary — auth before endpoints, contracts before consumers, and reconciliation alongside events rather than after, because retrofitting any of those means rewriting the layer above.

Track progress by checking boxes in this file as you go.

---

## Phase 0 — Foundation

**Goal:** a monorepo where all three apps boot, share types, and talk to each other over authenticated HTTP.

- [x] pnpm workspace + Turborepo, with `apps/*` and `packages/*`
- [x] Shared `packages/tsconfig` and `packages/eslint-config`
- [x] `packages/contracts` with Zod schemas for `MeetingType`, `Meeting`, `Attendance`, all enums, and every request/response DTO
- [x] NestJS API skeleton: `/api/v1` prefix, zod-validated env config, pino logging, global exception filter, `ZodValidationPipe`
- [x] Mongoose connection with a health check at `GET /health`
- [x] `ServiceTokenGuard` — validates `X-Service-Token` for `/internal/*`
- [x] `JwtGuard` + `GuildRoleGuard` for dashboard routes
- [x] discord.js client that logs in, a `/ping` command, and `deploy-commands` script
- [x] Typed `api-client.ts` in the bot with retry and exponential backoff
- [x] Next.js app with Auth.js Discord provider; login mints a JWT after verifying guild membership
- [x] `infra/docker-compose.yml` with mongo + mongo-express
- [x] Vitest + `mongodb-memory-server` configured; one passing sample test
- [x] All `.env.example` files

**Checkpoint:** `pnpm dev` starts all three. `/ping` in Discord returns a response fetched from the API. Logging into the dashboard shows your Discord username. `pnpm typecheck && pnpm lint && pnpm test` is clean.

Auth is in Phase 0 deliberately. Bolting guards onto an existing controller surface later is miserable work.

---

## Phase 1 — Schemas and indexes

**Goal:** the data model exists and the database enforces its own invariants.

- [ ] `MeetingTypeSchema` with `guildId`, roles as `{ roleId, nameSnapshot }`, `archived`
- [ ] `MeetingSchema` with status enum, `voiceChannelIds` array, `pauses[]`, `expectedMembers[]`, `summary` fields, nullable `stats`
- [ ] `AttendanceSchema` with `sessions[]` including `source`, `expected`, `manuallyEdited`, nullable `stats`
- [ ] Partial unique index on `{ guildId, voiceChannelIds }` for status in `['ACTIVE','PAUSED']`
- [ ] Compound unique index on `{ meeting, discordUserId }`
- [ ] Query indexes for the history and active-meeting pages
- [ ] Duplicate-key (11000) handling mapped to `ConflictException`
- [ ] Seed script producing one guild, two meeting types, and three completed meetings with realistic attendance

**Checkpoint:** tests prove that inserting a second active meeting on the same channel throws, and that a second attendance document for the same user and meeting throws. The seed script runs clean twice in a row.

No `MeetingReport` collection. The summary lives on the meeting.

---

## Phase 2 — Meeting types

**Goal:** full CRUD, driven from Discord.

- [ ] `MeetingTypesService` and controller for list, create, get, patch, soft-delete
- [ ] All input validated against the shared Zod schemas
- [ ] `/configure-meeting` — modal for the name, `RoleSelectMenuBuilder` for roles
- [ ] `/edit-meeting-type` — select the type, then modal and role select, prefilled
- [ ] Refresh `nameSnapshot` on every edit
- [ ] Permission gate via `setDefaultMemberPermissions(ManageEvents)`
- [ ] Embed builders for success and error states

**Checkpoint:** you can create a meeting type entirely from Discord using native selects, edit it, and see the change reflected via `GET /meeting-types`. Renaming the role in Discord does not break the type.

Native components, not free-text parsing. This eliminates role-name typos by construction.

---

## Phase 3 — Meeting lifecycle

**Goal:** the state machine, with no attendance tracking yet.

- [ ] `MeetingLifecycleService`: `start`, `pause`, `resume`, `end`, `cancel`
- [ ] `start` validates the type, snapshots `expectedMembers` via `guild.members.fetch()`, relies on the index for the single-active-meeting rule
- [ ] Illegal transitions throw (`COMPLETED → PAUSED`, and so on)
- [ ] `pauses[]` recorded on pause and resume
- [ ] `end` sets `endedAt`, `endedBy`, `status`
- [ ] `cancel` sets `cancelReason`, produces no report
- [ ] `/start-meeting` detects the caller's voice channel and errors clearly if they are not in one
- [ ] `/pause-meeting`, `/resume-meeting`, `/end-meeting`, `/cancel-meeting`
- [ ] `MeetingSweeper` cron: auto-end after 15 minutes empty, hard cap at 12 hours, `endedBy: 'SYSTEM'`, backdated `endedAt`

**Checkpoint:** every transition works from Discord. Every illegal transition returns a readable error in the channel. A meeting left running with an empty channel is closed by the sweeper within a sweep interval.

The sweeper is not optional. Someone will start a meeting and go home, and the uniqueness index will then block that channel forever.

---

## Phase 4 — Attendance resolver and reconciliation

The most important phase. Build the resolver and the reconciler together — shipping events alone means Phase 5 is spent cleaning up corrupt data.

- [ ] `AttendanceResolverService.resolvePresence(meetingId, { presentUserIds, observedAt, scope, source })`
- [ ] Open a session only when no session is open, as one atomic upsert
- [ ] Close sessions only when `scope: 'FULL'`
- [ ] Ignore everything while the meeting is `PAUSED`
- [ ] Discard an `observedAt` that predates the open session's `joinedAt`
- [ ] Mark attendees with no matching expected role as `expected: false`
- [ ] `pause` closes all open sessions; `resume` re-opens for current occupants
- [ ] `POST /internal/voice-events` and `POST /meetings/:id/attendance/sync`
- [ ] `voice-state-update.ts` filtering bots, unchanged channels, and treating the AFK channel as a departure
- [ ] Channel moves sent as a single event carrying `from` and `to`
- [ ] Bounded, per-user ordered `event-queue.ts` in the bot
- [ ] `reconciler.ts`: every 60s per active meeting, plus on `ready` and `shardResume`
- [ ] `POST /internal/bootstrap` so the bot can discover active meetings after a restart
- [ ] `/meeting-status` showing live occupants

**Checkpoint:** every scenario in the README's testing section passes. Then verify manually: start a meeting with people in the channel, kill the bot process, have someone leave and someone else join, restart the bot, and confirm the record self-corrects within one sync interval.

That manual test is the whole reason the reconciler exists. Actually run it.

---

## Phase 5 — Stats, reports, and summaries

**Goal:** meaningful output, both in Discord and via the API.

- [ ] `AttendanceStatsService`: first join, lateness, total duration excluding paused intervals, session count, currently-present
- [ ] Computed on read for live meetings, written once to `stats` at `end`
- [ ] Meeting-level `stats`: present, expected, unexpected, duration
- [ ] `GET /meetings/:id/report` assembling meeting + attendance + absentees from `expectedMembers`
- [ ] Attendance report embed posted on `/end-meeting`
- [ ] `PATCH /meetings/:id/summary` with `summaryUpdatedBy` and `summaryUpdatedAt`
- [ ] `POST /meetings/:id/attendance/manual` and `PATCH /attendance/:id`, both setting `manuallyEdited` and `editedBy`

**Checkpoint:** ending a meeting posts a correct report. Durations exclude paused time. Absentees come from the snapshot, not from current role membership. Frozen stats match what the live calculation returned a moment earlier.

Manual correction is what makes the system trustworthy. One night of a downed bot without an escape hatch and people stop believing the numbers.

---

## Phase 6 — Dashboard

**Goal:** view history, watch live meetings, edit summaries.

- [ ] Protected layout with sidebar and Discord profile
- [ ] Overview: active meetings, recent meetings, counts
- [ ] Meetings list with status filter and pagination
- [ ] Meeting detail: header, attendance table (member, first join, duration, sessions, late), absentees section
- [ ] Live view polling `/meetings/active` every 10s via TanStack Query, with a live indicator
- [ ] Inline summary editor with optimistic update
- [ ] Manual attendance correction UI, flagged visually where `manuallyEdited`
- [ ] Meeting types list and editor
- [ ] Loading skeletons, empty states, error boundaries
- [ ] Responsive down to mobile

**Checkpoint:** a meeting running in Discord is visible live in the dashboard and updates within a poll interval. Editing a summary persists and shows the editor's name.

---

## Phase 7 — Hardening and deploy

- [ ] Rate limiting on `/internal/*`
- [ ] Locked-down CORS
- [ ] Structured logs with `meetingId` correlation throughout
- [ ] Sentry on all three apps
- [ ] Graceful shutdown: bot flushes the event queue before exiting
- [ ] Dockerfiles for api, bot, dashboard
- [ ] CI: lint, typecheck, test on every PR
- [ ] Deploy API and bot to Railway or Fly, dashboard to Vercel, Mongo to Atlas
- [ ] Register slash commands globally
- [ ] Health checks and uptime monitoring

**Checkpoint:** a real meeting runs end to end in production. Redeploying the API mid-meeting loses no attendance data.

Exactly one bot instance in production. Two means duplicate events and two reconcilers overwriting each other.

---

## Suggested prompts for Claude Code

Rough shape for kicking off each phase:

```
Read README.md and CLAUDE.md, then docs/BUILD_PLAN.md.
Implement Phase 0 only. Stop at the checkpoint and show me
that it passes. Do not start Phase 1.
```

```
Phase 4. Start with AttendanceResolverService and its tests before
writing any bot code — I want to see the test list first and agree
on it before you implement.
```

```
Phase 4 is done. Run every scenario in the README testing section
and show me the output. Then walk me through what happens if the
bot dies between a join event and its HTTP call.
```

Ask for the test list before the implementation on Phase 4. If the tests are right, the resolver will be too.
