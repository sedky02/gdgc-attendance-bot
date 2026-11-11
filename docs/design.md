# Design

How the system is modelled and why. The README has the summary; this is the detail.

## Core principles

**1. The API owns all business logic.**
The Discord bot receives commands and events, calls the API, and renders the response. It never touches the database. It has no `MONGODB_URI`. If you find yourself writing a Mongoose model inside `apps/bot`, stop — the logic belongs in a service in `apps/api`.

**2. Attendance is a reconciled state, not an event log.**
Voice events are lossy. Bots restart, gateways disconnect, HTTP calls fail. Every active meeting is therefore re-synced against the real voice channel roster every 60 seconds (`RECONCILE_INTERVAL_MS`), on bot startup, and when a dropped gateway session resumes. Events give precision; sync guarantees correctness. Both go through the same idempotent resolver.

**3. Historical records never change retroactively.**
Usernames, role names, and the expected-member list are snapshotted at write time. A member leaving the club next semester must not alter the attendance record of a meeting held today.

**4. Derived values are computed while live, frozen when complete.**
Duration, lateness, and session counts are calculated on read for `ACTIVE` meetings and written once at `/end-meeting`. This keeps live data correct without making the history page aggregate the entire collection.

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

  startedBy: string,               // discord user id
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
  summaryUpdatedBy: string | null, // username snapshot of the editor
  summaryUpdatedAt: Date | null,

  lastActivityAt: Date | null,     // last observation with someone present; drives the sweeper

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
  guildId: string,                 // copied from the meeting at write time
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
  editedBy: string | null,         // username snapshot of the editor

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

// the sweeper and the bot's bootstrap look up live meetings across guilds
MeetingSchema.index({ status: 1, lastActivityAt: 1 });
```

Invariants belong in the database. Application-level "check then write" loses to concurrency every time.

## The attendance resolver

The single component that mutates sessions. Everything else calls it.

```ts
resolvePresence(meetingId, {
  presentMembers: PresentMember[],  // full roster, or a single member for a join event
  observedAt: Date,
  scope: 'FULL' | 'PARTIAL',        // FULL closes sessions for anyone absent
  source: 'EVENT' | 'SYNC'
})

resolveDeparture(meetingId, discordUserId, observedAt)   // closes exactly one member's open session
closeAllOpenSessions(meetingId, observedAt)              // pause, end, cancel, sweeper
applyManualCorrection(meeting, correction)               // dashboard edits
```

Rules:

- **Timestamps come from the caller**, never `Date.now()` inside the API. A retried request must not shift the record.
- **Opening is conditional and atomic.** One upsert whose filter only matches a record with no open session and nothing recorded after `observedAt`. When the record exists but fails that precondition, the upsert's insert attempt hits the unique `(meeting, discordUserId)` index, and that duplicate-key error is the no-op. There is no read-then-write.
- **Closing only applies with `scope: 'FULL'`.** A join event tells you one person arrived; it says nothing about anyone else.
- **`PAUSED` meetings ignore everything.** No sessions open or close while paused.
- **Late-arriving observations are discarded.** A close older than the open session's `joinedAt` is ignored; a join older than the last recorded session is ignored.
- **A departure touches one member.** It is not derived from a roster diff, so it cannot close someone whose join is being written at the same moment.
- **Manual edits are validated.** A hand-entered session list must be chronological, non-overlapping, and open only at the end.

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

The sweeper runs every 5 minutes and auto-ends any `ACTIVE` meeting with no activity for more than 15 minutes, backdating `endedAt` to the last observed activity. It also hard-caps meetings at 12 hours. Either way it closes open sessions and freezes stats exactly as `/end-meeting` does. Without it, one forgotten `/start-meeting` permanently blocks that channel via the uniqueness index.

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
POST   /meetings/:id/attendance/sync      # full roster reconciliation: { presentMembers, observedAt }
POST   /meetings/:id/attendance/manual    # lead correction, replaces one attendee's sessions
PATCH  /attendance/:id                    # replace a record's sessions, audited
```

### Internal (service token only)

```
GET    /internal/ping
POST   /internal/voice-events             # { guildId, discordUserId, usernameSnapshot, displayNameSnapshot, from, to, occurredAt }
POST   /internal/bootstrap                # bot startup: list live meetings to reconcile
```

Deleting a meeting is intentionally absent. Cancelled and completed meetings stay in the database.

### Authorization

| Caller | Credential | Scope |
|---|---|---|
| Bot | `X-Service-Token` | All guilds, all routes |
| Dashboard | `Authorization: Bearer <JWT>` | One guild. Reads always; writes only when the token carries `canManage`, which the dashboard sets from the user's Manage Events permission (or Administrator, or ownership) at sign-in |

For a dashboard caller the editor recorded on a manual edit or summary change is taken from the JWT, not from the request body.

## Data rules and invariants

1. A voice channel has at most one `ACTIVE` or `PAUSED` meeting. Enforced by a partial unique index.
2. A user has at most one `Attendance` document per meeting. Enforced by a compound unique index.
3. An `Attendance` has at most one session with `leftAt: null`. Enforced by the resolver.
4. Attendance timestamps always come from the observing client, never from server processing time. The one exception is the sweeper, a cron with no observer: it backdates to the last observed activity rather than using its own clock for `endedAt`.
5. Usernames and role names are snapshots. Discord IDs are canonical.
6. Meetings are never deleted, including cancelled ones.
7. Derived values are computed on read while live, and written once on completion.
8. `expectedMembers` is written at start and never mutated.
9. Manual edits set `manuallyEdited: true` and record the editor.
10. Bot users are excluded from attendance entirely.
