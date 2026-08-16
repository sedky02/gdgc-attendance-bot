# Discord Meeting Management System

## 1. Overview

A Discord bot backed by a REST API and a web dashboard for managing university club meetings.

The MVP focuses on:

- Configuring reusable meeting types
- Starting and managing live meetings from Discord
- Tracking voice channel attendance
- Tracking every join and leave session
- Generating attendance information when a meeting ends
- Manually adding a meeting summary
- Viewing historical meetings and attendance from a dashboard

The Discord bot is only an interface. Business logic lives in the API.

---

# 2. Architecture

```text
                         Discord
                            │
                            ▼
                     Discord Bot
                            │
                       HTTP / API
                            │
                            ▼
                    ┌──────────────┐
                    │    NestJS    │
                    │     API      │
                    └──────┬───────┘
                           │
                 ┌─────────┼─────────┐
                 ▼         ▼         ▼
             Meetings   Attendance  Reports
                 │         │         │
                 └─────────┼─────────┘
                           ▼
                       MongoDB
                       Mongoose

                    Next.js Dashboard
                           │
                        HTTP API
                           │
                           ▼
                       NestJS API
```

## Architecture principles

### API is the source of truth

The Discord bot must not contain the application's business logic.

The bot should:

1. Receive Discord commands/events.
2. Call the API.
3. Display the API response in Discord.

The dashboard uses the same API.

This prevents duplicated logic between Discord and the dashboard.

### Discord events

Voice state changes are received by the Discord bot.

For example:

```text
User joins voice channel
        ↓
Bot receives voiceStateUpdate
        ↓
Bot calls API
        ↓
API checks for an active meeting
        ↓
Attendance is updated
```

The API decides whether the event matters.

---

# 3. Technology Stack

Recommended MVP stack:

- Discord.js
- NestJS
- MongoDB
- Mongoose
- Next.js
- REST API
- TypeScript

Redis is not required for the initial MVP.

It can be introduced later for scheduled jobs, caching, distributed event processing, or reminders if needed.

---

# 4. Core Domain Concepts

The MVP contains four main database collections:

```text
MeetingType
Meeting
Attendance
MeetingReport
```

The important distinction is:

```text
MeetingType = reusable configuration

Meeting = one actual occurrence

Attendance = a user's attendance in one meeting

MeetingReport = manual report/summary for a meeting
```

---

# 5. MeetingType

A MeetingType defines what kind of meeting is being held.

Example:

```text
Weekly Technical Meeting
```

A MeetingType contains a list of Discord roles whose members are expected to attend.

## Schema

```text
MeetingType
├── _id
├── name
├── roles[]
├── createdBy
├── createdAt
└── updatedAt
```

Example:

```json
{
  "name": "Weekly Technical Meeting",
  "roles": [
    "Technical Lead",
    "Developer",
    "Member"
  ]
}
```

The roles are configuration only.

There are no minimum attendance requirements or strict role quotas.

If a different meeting configuration is needed, a different MeetingType can be created.

---

# 6. Meeting

A Meeting represents one actual occurrence of a MeetingType.

The meeting does not need its own title.

Its name comes from:

```text
Meeting → MeetingType → name
```

## Schema

```text
Meeting
├── _id
├── meetingType
├── voiceChannelId
├── startedBy
├── startedAt
├── endedAt
├── status
├── summary
└── createdAt
```

## Status

```text
ACTIVE
PAUSED
COMPLETED
CANCELLED
```

## Example

```json
{
  "meetingType": "665...",
  "voiceChannelId": "123456789",
  "startedBy": "987654321",
  "startedAt": "2026-08-16T18:00:00Z",
  "endedAt": "2026-08-16T19:30:00Z",
  "status": "COMPLETED",
  "summary": "Discussed the upcoming hackathon and assigned preparation tasks."
}
```

## Why store voiceChannelId?

The meeting is started from the voice channel, so the channel ID is known immediately.

It is stored because attendance events need to determine which active meeting they belong to.

The core lookup is:

```text
voiceChannelId
    ↓
find ACTIVE meeting
    ↓
process attendance event
```

An important invariant:

> One voice channel should have at most one active meeting.

---

# 7. Attendance

Attendance represents one Discord user's attendance during one meeting.

The Discord user ID identifies the user.

The username is also stored as a snapshot so historical records can display the name without depending entirely on Discord.

## Schema

```text
Attendance
├── _id
├── meeting
├── discordUserId
├── username
└── sessions[]
      ├── joinedAt
      └── leftAt
```

Example:

```json
{
  "meeting": "665...",
  "discordUserId": "123456789",
  "username": "aymen",
  "sessions": [
    {
      "joinedAt": "2026-08-16T18:05:00Z",
      "leftAt": "2026-08-16T18:40:00Z"
    },
    {
      "joinedAt": "2026-08-16T18:50:00Z",
      "leftAt": "2026-08-16T19:30:00Z"
    }
  ]
}
```

## Why store username?

Yes, store it.

The Discord user ID is the stable identifier, while the username is useful as historical display data.

If the user later changes their Discord username, old meeting records still show the name that was recorded during that meeting.

The Discord user ID remains the canonical identifier.

## Why sessions?

A user can leave and return multiple times.

Example:

```text
19:00 JOIN
19:30 LEAVE
19:40 JOIN
20:00 LEAVE
20:10 JOIN
20:30 LEAVE
```

The database preserves this as three sessions.

This allows the system to calculate:

- First arrival
- Lateness
- Number of joins
- Number of departures
- Total attendance duration
- Individual attendance sessions

Derived values should initially be calculated rather than stored.

---

# 8. Meeting Summary

The summary is simply a string stored directly on the Meeting.

There is no separate report summary model.

## Meeting

```text
summary: string | null
```

Example:

```text
"Discussed the hackathon schedule, workshop planning and upcoming technical tasks."
```

The lead can manually add or edit it from the dashboard.

No AI, transcript, action items, or automatic summarization is part of the MVP.

---

# 9. MeetingReport

A MeetingReport stores report metadata if a separate report entity is useful.

## Schema

```text
MeetingReport
├── _id
├── meeting
├── createdBy
├── createdAt
└── updatedAt
```

The actual meeting summary remains on the Meeting.

If the MVP does not require report-specific metadata, this collection can also be omitted and reports can simply be generated from Meeting + Attendance.

The simplest implementation is therefore:

```text
Meeting
  ├── summary
  └── Attendance[]
```

A separate MeetingReport collection should only be introduced when report-specific functionality is actually needed.

---

# 10. Discord Commands

## `/configure-meeting`

Creates a new MeetingType.

The command asks for:

```text
Name
Roles
```

Example:

```text
/configure-meeting

Name:
Weekly Technical Meeting

Roles:
Technical Lead
Developer
Member
```

---

## `/edit-meeting-type`

Edits an existing MeetingType.

Possible fields:

```text
Name
Roles
```

This affects the reusable meeting type, not previous meetings.

---

## `/start-meeting`

Executed inside a Discord voice channel.

The command asks the user to select a MeetingType.

Example:

```text
/start-meeting

Select meeting type:

[Weekly Technical Meeting]
[Board Meeting]
[Frontend Meeting]
```

The bot then sends the API:

```text
POST /meetings
```

with information such as:

```json
{
  "meetingTypeId": "...",
  "voiceChannelId": "...",
  "startedBy": "..."
}
```

The API:

1. Validates the MeetingType.
2. Checks that the voice channel does not already have an active meeting.
3. Creates the Meeting.
4. Determines expected members based on the MeetingType roles.
5. Checks who is currently inside the voice channel.
6. Creates attendance sessions for users already present.
7. Returns the meeting status.

---

# 11. Initial Attendance State

When a meeting starts:

```text
Expected members
        ↓
Check current voice channel members
        ↓
Present
        +
Absent
```

Example:

```text
Weekly Technical Meeting

Present: 5
Absent: 3

Present:
@Aymen
@Sami
@Ali
@Yassine
@Ahmed

Absent:
@User1
@User2
@User3
```

Only users who actually attend need an Attendance document.

Absent users do not necessarily need an Attendance document.

Their absence can be determined by comparing expected members against recorded attendance.

---

# 12. Voice State Tracking

The Discord bot listens to Discord voice state events.

## User joins

```text
voiceStateUpdate
        ↓
User joined voice channel
        ↓
Bot sends event to API
        ↓
API checks for ACTIVE meeting
        ↓
Find/create Attendance
        ↓
Create new session
```

## User leaves

```text
voiceStateUpdate
        ↓
User left voice channel
        ↓
Bot sends event to API
        ↓
API checks active meeting
        ↓
Find open attendance session
        ↓
Set leftAt
```

## User moves between voice channels

Treat a voice channel change as:

```text
Leave old channel
        ↓
Join new channel
```

The API should close the old session and only start a new session if the destination channel belongs to an active meeting.

---

# 13. Attendance Calculations

The system can derive useful information from the sessions.

### First arrival

```text
minimum(sessions.joinedAt)
```

### Lateness

```text
firstJoinedAt - meeting.startedAt
```

### Total attendance

```text
sum(session.leftAt - session.joinedAt)
```

### Number of sessions

```text
sessions.length
```

### Currently present

An attendance is currently active when its latest session has:

```text
leftAt = null
```

These values do not need to be stored in MongoDB for the MVP.

---

# 14. `/pause-meeting`

Changes:

```text
ACTIVE → PAUSED
```

When pausing:

1. Close all currently open attendance sessions.
2. Change the meeting status to `PAUSED`.
3. Ignore attendance events while paused.

---

# 15. `/resume-meeting`

Changes:

```text
PAUSED → ACTIVE
```

When resuming:

1. Check who is currently inside the meeting's voice channel.
2. Create new attendance sessions for those present.
3. Continue processing voice events.

This prevents a session from incorrectly spanning a pause.

---

# 16. `/end-meeting`

This is required to explicitly finish a meeting.

Flow:

```text
/end-meeting
      ↓
Close all open attendance sessions
      ↓
Set endedAt
      ↓
Set status = COMPLETED
      ↓
Generate/display attendance report
```

Example:

```text
Weekly Technical Meeting

19:00 → 20:35

Attendance
────────────────────

Aymen     19:02 → 20:35
Sami      19:00 → 20:10
Ali       19:17 → 20:35
Ahmed     ABSENT
```

---

# 17. `/cancel-meeting`

Changes:

```text
ACTIVE → CANCELLED
```

or:

```text
PAUSED → CANCELLED
```

When cancelling:

1. Close open attendance sessions.
2. Set status to `CANCELLED`.
3. Set cancellation time if desired.
4. Do not treat the meeting as completed.
5. Do not generate a normal completion report.

The meeting should remain in the database for historical purposes.

---

# 18. Editing Meetings

There are two different concepts.

### `/edit-meeting-type`

Changes the reusable MeetingType:

```text
Name
Roles
```

### Actual Meeting

An individual meeting should generally not be edited after starting.

Its identity comes from the MeetingType and its actual state is controlled by:

```text
start
pause
resume
end
cancel
```

This keeps the MVP simple.

---

# 19. Dashboard

The dashboard should consume the same API used by Discord.

## Main pages

```text
Dashboard
├── Overview
├── Meetings
│   ├── Active
│   └── History
└── Meeting Types
```

## Meetings page

Example:

```text
Meetings

Weekly Technical Meeting
16 Aug 2026
19:00 → 20:35
Attendance: 8 / 10

[View]
```

## Meeting details

```text
Weekly Technical Meeting

16 Aug 2026
19:00 → 20:35

Attendance
────────────────────────

Member       First Join   Duration

Aymen        19:02        1h33
Sami         19:00        1h10
Ali          19:17        1h18
Ahmed        ABSENT
```

Then:

```text
Summary
────────────────────────

[Edit]

Discussed the upcoming hackathon...
```

---

# 20. API Responsibilities

The API owns all business logic.

Possible API modules:

```text
Auth
MeetingTypes
Meetings
Attendance
Reports
```

Possible endpoints:

```text
GET    /meeting-types
POST   /meeting-types
PATCH  /meeting-types/:id
DELETE /meeting-types/:id

POST   /meetings
GET    /meetings
GET    /meetings/:id
POST   /meetings/:id/pause
POST   /meetings/:id/resume
POST   /meetings/:id/end
POST   /meetings/:id/cancel

POST   /meetings/:id/attendance/join
POST   /meetings/:id/attendance/leave

PATCH  /meetings/:id/summary
```

The exact endpoint design can change during implementation.

The important point is that both Discord and the dashboard use the same API.

---

# 21. Suggested Backend Modules

NestJS structure:

```text
src/
├── auth/
├── meeting-types/
├── meetings/
├── attendance/
├── reports/
├── discord/
└── common/
```

The Discord module should mainly handle Discord integration.

Business operations belong in the corresponding services.

Example:

```text
Discord Bot
    ↓
MeetingsService
    ↓
AttendanceService
    ↓
Mongoose
```

Not:

```text
Discord Command
    ↓
direct MongoDB manipulation
```

---

# 22. MongoDB Relationships

Conceptually:

```text
MeetingType
    │
    │ 1:N
    ▼
Meeting
    │
    │ 1:N
    ▼
Attendance
    │
    │ embedded
    ▼
Sessions
```

And:

```text
Meeting
    │
    └── summary
```

For MVP, embedding attendance sessions inside Attendance is appropriate because sessions belong entirely to one attendance record.

---

# 23. Important Data Rules

## Meeting

A voice channel can have at most one active meeting.

## Attendance

A user should have at most one Attendance document per Meeting.

```text
unique:
meeting + discordUserId
```

## Sessions

An Attendance should normally have at most one open session:

```text
leftAt = null
```

## Historical names

Store the username at attendance creation time.

The Discord user ID remains the canonical identifier.

## Cancelled meetings

Never delete them automatically.

## Derived values

Do not store values such as:

```text
totalDuration
lateness
numberOfJoins
```

unless performance later requires denormalization.

Calculate them from sessions initially.

---

# 24. MVP Scope

## Included

- Discord bot
- Discord slash commands
- Meeting type configuration
- Meeting type roles
- Start meeting
- Voice channel detection
- Real-time attendance tracking
- Join/leave session history
- Lateness calculation
- Multiple joins/leaves
- Pause meeting
- Resume meeting
- End meeting
- Cancel meeting
- Meeting history
- Manual meeting summary
- Dashboard
- REST API
- MongoDB/Mongoose

## Not included

- AI summaries
- Transcription
- Action items
- Task management
- Automatic report writing
- Minimum attendance requirements
- Role quotas
- Meeting requirement snapshots
- Scheduling
- Reminders
- Advanced analytics
- Redis

These can be added later without changing the core attendance concept.

---

# 25. Recommended MVP Flow

```text
                 Configure
                    │
                    ▼
              MeetingType
                    │
                    │
             /start-meeting
                    │
                    ▼
                 Meeting
                    │
          ┌─────────┴─────────┐
          │                   │
       Discord            Dashboard
          │
    voiceStateUpdate
          │
          ▼
      Attendance
          │
       Sessions
          │
          ▼
     /pause /resume
          │
          ▼
      /end-meeting
          │
          ▼
       Completed
          │
          ▼
    Manual Summary
          │
          ▼
       Dashboard
```

---

# 26. Recommended Implementation Order

### Phase 1: Database

Implement:

```text
MeetingType
Meeting
Attendance
```

### Phase 2: Meeting Types

Implement:

```text
/configure-meeting
/edit-meeting-type
```

### Phase 3: Meeting Lifecycle

Implement:

```text
/start-meeting
/pause-meeting
/resume-meeting
/end-meeting
/cancel-meeting
```

### Phase 4: Attendance

Implement Discord voice events:

```text
join
leave
move channel
```

and persist sessions.

### Phase 5: Reports

Add:

```text
Meeting.summary
```

and manual editing.

### Phase 6: Dashboard

Start with:

```text
Meeting list
Meeting details
Attendance
Summary
Meeting types
```

This order gets the core system working before adding UI complexity.
