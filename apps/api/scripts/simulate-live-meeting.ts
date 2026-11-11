import "dotenv/config";
import {
  DEMO_GUILD,
  DEMO_USER,
  MeetingReportSchema,
  MeetingSchema,
  MeetingTypeSchema,
  type Meeting,
  type PresentMember,
  type StartMeetingDto,
  type SyncAttendanceDto,
  type VoiceEventDto,
} from "@meeting-system/contracts";
import { z } from "zod";

/**
 * Plays the bot's part against a running API for the Discord-free demo: it
 * starts a meeting, then sends the same voice events and roster syncs the bot
 * would, through the same service-token endpoints. Ctrl-C ends the meeting.
 *
 * The meeting is reported as having started 25 minutes ago and its first
 * events are backdated to match, so the dashboard opens on realistic
 * durations. That is legitimate use of the API: every timestamp is supplied
 * by the observer, never taken from the server clock.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api/v1`;
const SERVICE_TOKEN = process.env.BOT_SERVICE_TOKEN;
const STEP_INTERVAL_MS = Number(process.env.DEMO_STEP_INTERVAL_MS ?? 10000);
const SYNC_INTERVAL_MS = Number(process.env.DEMO_SYNC_INTERVAL_MS ?? 15000);

const MEETING_TYPE_NAME = "Weekly Technical Meeting";
const VOICE_CHANNEL_ID = "101010101010101010";
const MEMBER_ROLE_ID = "222222222222222222";

const member = (discordUserId: string, displayNameSnapshot: string): PresentMember => ({
  discordUserId,
  usernameSnapshot: displayNameSnapshot.toLowerCase(),
  displayNameSnapshot,
});

const aymen = member("555555555555555555", "Aymen");
const sami = member("666666666666666666", "Sami");
const ali = member("777777777777777777", "Ali");
const ahmed = member("888888888888888888", "Ahmed");
const yasmine = member("999999999999999991", "Yasmine");
const karim = member("999999999999999992", "Karim");
const nour = member("999999999999999993", "Nour");
const guest = member("999999999999999994", "Lina");

const EXPECTED = [aymen, sami, ali, ahmed, yasmine, karim, nour];
const PRESENT_AT_START = [aymen, sami];

type Step = { who: PresentMember; action: "join" | "leave" };

const BACKDATED_START_MINUTES_AGO = 25;
const BACKDATED_STORY: (Step & { minutesAfterStart: number })[] = [
  { who: ali, action: "join", minutesAfterStart: 3 },
  { who: yasmine, action: "join", minutesAfterStart: 7 },
  { who: guest, action: "join", minutesAfterStart: 11 },
  { who: sami, action: "leave", minutesAfterStart: 15 },
  { who: sami, action: "join", minutesAfterStart: 19 },
];

const LIVE_STORY: Step[] = [
  { who: karim, action: "join" },
  { who: guest, action: "leave" },
  { who: ali, action: "leave" },
  { who: ali, action: "join" },
];

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Service-Token": SERVICE_TOKEN ?? "" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = () => new Date().toLocaleTimeString("en-GB");

async function sendVoiceEvent(step: Step, occurredAt: Date): Promise<void> {
  const joining = step.action === "join";
  const event: VoiceEventDto = {
    guildId: DEMO_GUILD.id,
    ...step.who,
    from: joining ? null : VOICE_CHANNEL_ID,
    to: joining ? VOICE_CHANNEL_ID : null,
    occurredAt,
  };
  await call("POST", "/internal/voice-events", event);
}

function applyToRoster(roster: Map<string, PresentMember>, step: Step): void {
  if (step.action === "join") roster.set(step.who.discordUserId, step.who);
  else roster.delete(step.who.discordUserId);
}

async function startMeeting(): Promise<Meeting> {
  const live = z.array(MeetingSchema).parse(await call("GET", `/meetings/active?guildId=${DEMO_GUILD.id}`));
  if (live.some((meeting) => meeting.voiceChannelIds.includes(VOICE_CHANNEL_ID))) {
    throw new Error("A meeting is already live on the demo channel. End it (Ctrl-C in the other simulator) or re-run the seed.");
  }

  const types = z.array(MeetingTypeSchema).parse(await call("GET", `/meeting-types?guildId=${DEMO_GUILD.id}`));
  const meetingType = types.find((type) => type.name === MEETING_TYPE_NAME);
  if (!meetingType) {
    throw new Error(`Meeting type "${MEETING_TYPE_NAME}" not found. Run "pnpm --filter api seed" first.`);
  }

  const dto: StartMeetingDto = {
    guildId: DEMO_GUILD.id,
    meetingTypeId: meetingType.id,
    voiceChannelIds: [VOICE_CHANNEL_ID],
    startedBy: DEMO_USER.discordUserId,
    expectedMembers: EXPECTED.map((m) => ({
      discordUserId: m.discordUserId,
      usernameSnapshot: m.usernameSnapshot,
      roleIds: [MEMBER_ROLE_ID],
    })),
    presentMembers: PRESENT_AT_START,
    observedAt: new Date(Date.now() - BACKDATED_START_MINUTES_AGO * 60_000),
  };
  const meeting = MeetingSchema.parse(await call("POST", "/meetings", dto));
  console.log(
    `[${clock()}] Started "${MEETING_TYPE_NAME}" (${meeting.id}), reported as running for ${BACKDATED_START_MINUTES_AGO} minutes`,
  );
  return meeting;
}

async function main() {
  if (!SERVICE_TOKEN) {
    throw new Error("BOT_SERVICE_TOKEN is required (it is read from apps/api/.env)");
  }

  const meeting = await startMeeting();
  const roster = new Map(PRESENT_AT_START.map((m) => [m.discordUserId, m]));
  let stopping = false;

  for (const step of BACKDATED_STORY) {
    await sendVoiceEvent(step, new Date(meeting.startedAt.getTime() + step.minutesAfterStart * 60_000));
    applyToRoster(roster, step);
  }
  console.log(`[${clock()}] Replayed ${BACKDATED_STORY.length} earlier joins and leaves (${roster.size} in the channel)`);

  const sync = async () => {
    const dto: SyncAttendanceDto = { presentMembers: [...roster.values()], observedAt: new Date() };
    await call("POST", `/meetings/${meeting.id}/attendance/sync`, dto);
  };

  const endMeeting = async () => {
    if (stopping) return;
    stopping = true;
    await call("POST", `/meetings/${meeting.id}/end`, { endedBy: DEMO_USER.discordUserId, observedAt: new Date() });
    const report = MeetingReportSchema.parse(await call("GET", `/meetings/${meeting.id}/report`));
    console.log(
      `\n[${clock()}] Ended the meeting: ${report.attendance.length} attended, ${report.absentees.length} absent. ` +
        "The dashboard now shows the frozen report.",
    );
    process.exit(0);
  };
  process.on("SIGINT", () => void endMeeting());
  process.on("SIGTERM", () => void endMeeting());

  console.log(`[${clock()}] Open the dashboard and watch the meeting page. Press Ctrl-C to end the meeting.`);

  await sync();

  for (const step of LIVE_STORY) {
    await sleep(STEP_INTERVAL_MS);
    if (stopping) return;

    await sendVoiceEvent(step, new Date());
    applyToRoster(roster, step);
    console.log(
      `[${clock()}] ${step.who.displayNameSnapshot} ${step.action === "join" ? "joined" : "left"} (${roster.size} in the channel)`,
    );
  }

  console.log(`[${clock()}] Story finished. Syncing the roster every ${SYNC_INTERVAL_MS / 1000}s so the meeting stays live.`);
  while (!stopping) {
    await sync();
    await sleep(SYNC_INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
