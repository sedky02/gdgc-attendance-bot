import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { AttendanceResolverService } from "./attendance-resolver.service.js";
import { Attendance, AttendanceSchema } from "./schemas/attendance.schema.js";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";

describe("AttendanceResolverService", () => {
  let mongod: MongoMemoryServer;
  let resolver: AttendanceResolverService;
  let attendanceModel: Model<Attendance>;
  let meetingModel: Model<Meeting>;
  let meetingId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Attendance.name, schema: AttendanceSchema },
          { name: Meeting.name, schema: MeetingSchema },
        ]),
      ],
      providers: [AttendanceResolverService],
    }).compile();

    resolver = moduleRef.get(AttendanceResolverService);
    attendanceModel = moduleRef.get(getModelToken(Attendance.name));
    meetingModel = moduleRef.get(getModelToken(Meeting.name));
  });

  afterEach(async () => {
    await attendanceModel.deleteMany({});
    await meetingModel.deleteMany({});
  });

  afterAll(async () => {
    await attendanceModel.db.close();
    await mongod.stop();
  });

  const aymen = { discordUserId: "user-1", usernameSnapshot: "aymen", displayNameSnapshot: "Aymen" };
  const sami = { discordUserId: "user-2", usernameSnapshot: "sami", displayNameSnapshot: "Sami" };

  async function createMeeting(
    overrides: Partial<{ status: string; expectedMembers: unknown[]; voiceChannelIds: string[] }> = {},
  ) {
    const doc = await meetingModel.create({
      guildId: "guild-1",
      meetingType: "000000000000000000000001",
      voiceChannelIds: ["channel-1"],
      status: "ACTIVE",
      startedBy: "manager-1",
      startedAt: new Date("2026-08-16T19:00:00Z"),
      endedBy: null,
      endedAt: null,
      cancelReason: null,
      pauses: [],
      expectedMembers: [{ discordUserId: aymen.discordUserId, usernameSnapshot: aymen.usernameSnapshot, roleIds: [] }],
      summary: null,
      summaryUpdatedBy: null,
      summaryUpdatedAt: null,
      stats: null,
      lastActivityAt: new Date("2026-08-16T19:00:00Z"),
      ...overrides,
    });
    return doc._id.toString();
  }

  async function openSessions(id: string) {
    const docs = await attendanceModel.find({ meeting: id });
    return docs.map((d) => ({
      discordUserId: d.discordUserId,
      open: d.sessions.some((s) => s.leftAt === null),
      sessionCount: d.sessions.length,
      expected: d.expected,
    }));
  }

  beforeEach(async () => {
    meetingId = await createMeeting();
  });

  describe("opening (scope: PARTIAL — a join event)", () => {
    it("opens one session for a new arrival", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });

      const sessions = await openSessions(meetingId);
      expect(sessions).toEqual([{ discordUserId: aymen.discordUserId, open: true, sessionCount: 1, expected: true }]);
    });

    it("marks an attendee with no matching expected role as expected: false", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [sami],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });

      const sessions = await openSessions(meetingId);
      expect(sessions[0].expected).toBe(false);
    });

    it("duplicate join events produce one session, not two", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:03:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });

      const sessions = await openSessions(meetingId);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionCount).toBe(1);
    });

    it("two concurrent joins for the same user create one attendance document", async () => {
      await Promise.all([
        resolver.resolvePresence(meetingId, {
          presentMembers: [aymen],
          observedAt: new Date("2026-08-16T19:02:00Z"),
          scope: "PARTIAL",
          source: "EVENT",
        }),
        resolver.resolvePresence(meetingId, {
          presentMembers: [aymen],
          observedAt: new Date("2026-08-16T19:02:01Z"),
          scope: "PARTIAL",
          source: "EVENT",
        }),
      ]);

      const docs = await attendanceModel.find({ meeting: meetingId, discordUserId: aymen.discordUserId });
      expect(docs).toHaveLength(1);
      expect(docs[0].sessions.filter((s) => s.leftAt === null)).toHaveLength(1);
    });

    it("PARTIAL scope never closes anyone, even if they're absent from presentMembers", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });
      // sami is not present, but a partial call about aymen says nothing about sami.
      await resolver.resolvePresence(meetingId, {
        presentMembers: [sami],
        observedAt: new Date("2026-08-16T19:05:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });

      const sessions = await openSessions(meetingId);
      expect(sessions.find((s) => s.discordUserId === aymen.discordUserId)?.open).toBe(true);
    });

    it("ignores everything while the meeting is PAUSED", async () => {
      const pausedMeetingId = await createMeeting({ status: "PAUSED", voiceChannelIds: ["channel-paused"] });

      await resolver.resolvePresence(pausedMeetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });

      const docs = await attendanceModel.find({ meeting: pausedMeetingId });
      expect(docs).toHaveLength(0);
    });
  });

  describe("closing (scope: FULL)", () => {
    it("join then leave produces one closed session", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });

      await resolver.resolveDeparture(meetingId, aymen.discordUserId, new Date("2026-08-16T20:00:00Z"), "EVENT");

      const doc = await attendanceModel.findOne({ meeting: meetingId, discordUserId: aymen.discordUserId });
      expect(doc?.sessions).toHaveLength(1);
      expect(doc?.sessions[0].leftAt).toEqual(new Date("2026-08-16T20:00:00Z"));
    });

    it("a departure closes exactly that user, leaving everyone else's session open", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen, sami],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "FULL",
        source: "SYNC",
      });

      await resolver.resolveDeparture(meetingId, aymen.discordUserId, new Date("2026-08-16T19:30:00Z"), "EVENT");

      const sessions = await openSessions(meetingId);
      expect(sessions.find((s) => s.discordUserId === aymen.discordUserId)?.open).toBe(false);
      expect(sessions.find((s) => s.discordUserId === sami.discordUserId)?.open).toBe(true);
    });

    it("sync closes sessions for users who vanished during an outage", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen, sami],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "FULL",
        source: "SYNC",
      });

      // Outage: aymen left unnoticed. The next sync only sees sami.
      await resolver.resolvePresence(meetingId, {
        presentMembers: [sami],
        observedAt: new Date("2026-08-16T19:10:00Z"),
        scope: "FULL",
        source: "SYNC",
      });

      const sessions = await openSessions(meetingId);
      expect(sessions.find((s) => s.discordUserId === aymen.discordUserId)?.open).toBe(false);
      expect(sessions.find((s) => s.discordUserId === sami.discordUserId)?.open).toBe(true);
    });

    it("sync opens sessions for users who arrived during an outage", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "FULL",
        source: "SYNC",
      });

      // Outage: sami joined unnoticed. The next sync sees both.
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen, sami],
        observedAt: new Date("2026-08-16T19:10:00Z"),
        scope: "FULL",
        source: "SYNC",
      });

      const sessions = await openSessions(meetingId);
      expect(sessions.find((s) => s.discordUserId === sami.discordUserId)?.open).toBe(true);
    });

    it("discards a close whose observedAt predates the open session's joinedAt", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:10:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });

      // A stale/replayed close arrives after the fact, claiming a time before the join.
      await resolver.resolvePresence(meetingId, {
        presentMembers: [],
        observedAt: new Date("2026-08-16T19:05:00Z"),
        scope: "FULL",
        source: "SYNC",
      });

      const sessions = await openSessions(meetingId);
      expect(sessions.find((s) => s.discordUserId === aymen.discordUserId)?.open).toBe(true);
    });

    it("a replayed sync with an older observedAt changes nothing", async () => {
      // Real timeline: aymen present at T1, gone by T2.
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:00:00Z"), // T1
        scope: "FULL",
        source: "SYNC",
      });
      await resolver.resolvePresence(meetingId, {
        presentMembers: [],
        observedAt: new Date("2026-08-16T19:10:00Z"), // T2 — aymen closed here
        scope: "FULL",
        source: "SYNC",
      });

      // A delayed retry of the T1 sync arrives late, after T2 already closed aymen.
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:00:30Z"), // still before T2
        scope: "FULL",
        source: "SYNC",
      });

      const doc = await attendanceModel.findOne({ meeting: meetingId, discordUserId: aymen.discordUserId });
      expect(doc?.sessions).toHaveLength(1);
      expect(doc?.sessions[0].leftAt).toEqual(new Date("2026-08-16T19:10:00Z"));
    });

    it("ignores closing while the meeting is PAUSED", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:02:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });
      await meetingModel.updateOne({ _id: meetingId }, { status: "PAUSED" });

      await resolver.resolvePresence(meetingId, {
        presentMembers: [],
        observedAt: new Date("2026-08-16T19:05:00Z"),
        scope: "FULL",
        source: "SYNC",
      });

      const sessions = await openSessions(meetingId);
      expect(sessions.find((s) => s.discordUserId === aymen.discordUserId)?.open).toBe(true);
    });
  });

  describe("channel move between two tracked meetings", () => {
    it("closes the session in the departed meeting and opens one in the arrived meeting", async () => {
      const meetingA = meetingId;
      const meetingB = await createMeeting({ expectedMembers: [], voiceChannelIds: ["channel-2"] });

      await resolver.resolvePresence(meetingA, {
        presentMembers: [aymen],
        observedAt: new Date("2026-08-16T19:00:00Z"),
        scope: "PARTIAL",
        source: "EVENT",
      });

      const moveAt = new Date("2026-08-16T19:15:00Z");
      await resolver.resolveDeparture(meetingA, aymen.discordUserId, moveAt, "EVENT");
      await resolver.resolvePresence(meetingB, {
        presentMembers: [aymen],
        observedAt: moveAt,
        scope: "PARTIAL",
        source: "EVENT",
      });

      const inA = await attendanceModel.findOne({ meeting: meetingA, discordUserId: aymen.discordUserId });
      const inB = await attendanceModel.findOne({ meeting: meetingB, discordUserId: aymen.discordUserId });

      expect(inA?.sessions[0].leftAt).toEqual(moveAt);
      expect(inB?.sessions[0].leftAt).toBeNull();
    });
  });

  describe("closeAllOpenSessions", () => {
    it("closes every open session unconditionally, even while PAUSED", async () => {
      await resolver.resolvePresence(meetingId, {
        presentMembers: [aymen, sami],
        observedAt: new Date("2026-08-16T19:00:00Z"),
        scope: "FULL",
        source: "SYNC",
      });
      await meetingModel.updateOne({ _id: meetingId }, { status: "PAUSED" });

      await resolver.closeAllOpenSessions(meetingId, new Date("2026-08-16T19:30:00Z"));

      const sessions = await openSessions(meetingId);
      expect(sessions.every((s) => !s.open)).toBe(true);
    });
  });
});
