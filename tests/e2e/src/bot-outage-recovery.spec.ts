import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Attendance } from "@meeting-system/contracts";
import { SERVICE_TOKEN, startApi, type ApiProcess } from "./support/api-process.js";
import { FakeGateway, fakeMember } from "./support/fake-gateway.js";

const GUILD_ID = "900000000000000001";
const VOICE_CHANNEL_ID = "900000000000000002";
const MEMBER_ROLE_ID = "900000000000000003";
const MANAGER_ID = "900000000000000004";
const RECONCILE_INTERVAL_MS = 400;

const alice = fakeMember("900000000000000011", "Alice");
const bob = fakeMember("900000000000000012", "Bob");
const carol = fakeMember("900000000000000013", "Carol");
const dave = fakeMember("900000000000000014", "Dave");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function eventually(assertion: () => Promise<void>, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await sleep(50);
    }
  }
}

/**
 * Boots a bot "process": a fresh copy of the bot's real modules (so all
 * in-memory tracking starts empty, exactly as after a crash) wired to the
 * fake gateway the way src/index.ts wires them to discord.js.
 */
async function startBot(gateway: FakeGateway) {
  vi.resetModules();
  const reconciler = await import("../../../apps/bot/src/services/reconciler.js");
  const voiceEvents = await import("../../../apps/bot/src/events/voice-state-update.js");
  const eventQueue = await import("../../../apps/bot/src/services/event-queue.js");
  const { apiClient } = await import("../../../apps/bot/src/services/api-client.js");

  reconciler.initReconciler(gateway as never);
  voiceEvents.registerVoiceStateUpdateEvent(gateway as never);

  return {
    apiClient,
    trackMeeting: reconciler.trackMeeting,
    runStartupBootstrap: reconciler.bootstrap,
    crash: async () => {
      await eventQueue.drainEventQueue();
      reconciler.stopReconciler();
      gateway.removeAllListeners("voiceStateUpdate");
    },
  };
}

describe("bot outage recovery (API + MongoDB + the bot's real reconciler, fake Discord gateway)", () => {
  let mongod: MongoMemoryServer;
  let api: ApiProcess;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    api = await startApi(mongod.getUri("meetings-e2e"));

    process.env.API_BASE_URL = api.baseUrl;
    process.env.BOT_SERVICE_TOKEN = SERVICE_TOKEN;
    process.env.RECONCILE_INTERVAL_MS = String(RECONCILE_INTERVAL_MS);
  });

  afterAll(async () => {
    await api?.stop();
    await mongod?.stop();
  });

  it("attendance matches the voice channel within one reconcile cycle after the bot was down while the roster changed", async () => {
    const gateway = new FakeGateway(GUILD_ID, VOICE_CHANNEL_ID);
    const openSessionUserIds = (attendance: Attendance[]) =>
      attendance
        .filter((record) => record.sessions.some((session) => session.leftAt === null))
        .map((record) => record.discordUserId)
        .sort();
    const recordOf = (attendance: Attendance[], member: { id: string }) =>
      attendance.find((record) => record.discordUserId === member.id);

    // --- A meeting starts with Alice and Bob in the channel -----------------
    gateway.join(alice);
    gateway.join(bob);

    let bot = await startBot(gateway);
    const meetingType = await bot.apiClient.meetingTypes.create({
      guildId: GUILD_ID,
      name: "Weekly Technical Meeting",
      roles: [{ roleId: MEMBER_ROLE_ID, nameSnapshot: "Member" }],
      createdBy: MANAGER_ID,
    });
    const meeting = await bot.apiClient.meetings.start({
      guildId: GUILD_ID,
      meetingTypeId: meetingType.id,
      voiceChannelIds: [VOICE_CHANNEL_ID],
      startedBy: MANAGER_ID,
      expectedMembers: [alice, bob, carol, dave].map((member) => ({
        discordUserId: member.id,
        usernameSnapshot: member.user.username,
        roleIds: [MEMBER_ROLE_ID],
      })),
      presentMembers: [alice, bob].map((member) => ({
        discordUserId: member.id,
        usernameSnapshot: member.user.username,
        displayNameSnapshot: member.displayName,
      })),
      observedAt: new Date(),
    });
    bot.trackMeeting(meeting.id, GUILD_ID, [VOICE_CHANNEL_ID]);

    // --- While the bot is healthy, a gateway event is recorded --------------
    gateway.join(carol);
    await eventually(async () => {
      const attendance = await bot.apiClient.meetings.getAttendance(meeting.id);
      expect(openSessionUserIds(attendance)).toEqual([alice.id, bob.id, carol.id]);
      expect(recordOf(attendance, carol)?.sessions[0].source).toBe("EVENT");
    }, 5_000);

    // --- The bot goes down; the roster keeps changing, unobserved -----------
    await bot.crash();
    gateway.leave(bob);
    gateway.join(dave);
    gateway.leave(carol);
    gateway.join(carol);
    await sleep(RECONCILE_INTERVAL_MS * 3);

    const duringOutage = await bot.apiClient.meetings.getAttendance(meeting.id);
    expect(openSessionUserIds(duringOutage)).toEqual([alice.id, bob.id, carol.id]);
    expect(recordOf(duringOutage, dave)).toBeUndefined();

    // --- The bot restarts with empty memory and runs its startup bootstrap --
    const restartedAt = new Date();
    bot = await startBot(gateway);
    await bot.runStartupBootstrap();

    const afterRestart = await bot.apiClient.meetings.getAttendance(meeting.id);
    expect(openSessionUserIds(afterRestart)).toEqual(gateway.occupantIds);
    expect(openSessionUserIds(afterRestart)).toEqual([alice.id, carol.id, dave.id]);

    const bobRecord = recordOf(afterRestart, bob);
    expect(bobRecord?.sessions).toHaveLength(1);
    expect(bobRecord?.sessions[0].leftAt?.getTime()).toBeGreaterThanOrEqual(restartedAt.getTime());

    const daveRecord = recordOf(afterRestart, dave);
    expect(daveRecord?.sessions).toHaveLength(1);
    expect(daveRecord?.sessions[0].source).toBe("SYNC");
    expect(daveRecord?.sessions[0].joinedAt.getTime()).toBeGreaterThanOrEqual(restartedAt.getTime());

    // Nobody who stayed was double-counted. Carol's leave-and-return happened
    // entirely inside the outage, so it is invisible: the known limit of roster sync.
    expect(recordOf(afterRestart, alice)?.sessions).toHaveLength(1);
    expect(recordOf(afterRestart, carol)?.sessions).toHaveLength(1);

    // --- A second bootstrap (e.g. a gateway resume) changes nothing ---------
    await bot.runStartupBootstrap();
    const afterSecondBootstrap = await bot.apiClient.meetings.getAttendance(meeting.id);
    expect(afterSecondBootstrap.map((record) => record.sessions.length)).toEqual(
      afterRestart.map((record) => record.sessions.length),
    );

    // --- The periodic reconciler is running again on the restarted bot ------
    // The event listener is detached so only the interval sync can observe this departure.
    gateway.removeAllListeners("voiceStateUpdate");
    gateway.leave(alice);
    await eventually(async () => {
      const attendance = await bot.apiClient.meetings.getAttendance(meeting.id);
      expect(openSessionUserIds(attendance)).toEqual([carol.id, dave.id]);
    }, RECONCILE_INTERVAL_MS * 3);

    // --- Ending the meeting freezes a report that reflects all of it --------
    await bot.crash();
    const ended = await bot.apiClient.meetings.end(meeting.id, { endedBy: MANAGER_ID, observedAt: new Date() });
    expect(ended.status).toBe("COMPLETED");
    expect(ended.stats).toMatchObject({ presentCount: 4, expectedCount: 4, unexpectedCount: 0 });

    const report = await bot.apiClient.meetings.getReport(meeting.id);
    expect(report.absentees).toEqual([]);
    expect(report.attendance.every((record) => record.sessions.every((session) => session.leftAt !== null))).toBe(true);
  });
});
