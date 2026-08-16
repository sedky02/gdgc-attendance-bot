import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { AttendanceStatsService } from "./attendance-stats.service.js";
import { Attendance, AttendanceSchema } from "./schemas/attendance.schema.js";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";

describe("AttendanceStatsService", () => {
  let mongod: MongoMemoryServer;
  let service: AttendanceStatsService;
  let attendanceModel: Model<Attendance>;
  let meetingModel: Model<Meeting>;

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
      providers: [AttendanceStatsService],
    }).compile();

    service = moduleRef.get(AttendanceStatsService);
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

  describe("computeAttendanceStats", () => {
    it("returns null when there are no sessions", () => {
      expect(service.computeAttendanceStats([], new Date(), new Date())).toBeNull();
    });

    it("computes firstJoinedAt, lateness, total duration, and session count across multiple sessions", () => {
      const startedAt = new Date("2026-08-16T19:00:00Z");
      const sessions = [
        { joinedAt: new Date("2026-08-16T19:02:00Z"), leftAt: new Date("2026-08-16T20:00:00Z"), source: "EVENT" as const },
        { joinedAt: new Date("2026-08-16T20:05:00Z"), leftAt: new Date("2026-08-16T20:35:00Z"), source: "EVENT" as const },
      ];

      const stats = service.computeAttendanceStats(sessions, startedAt, new Date("2026-08-16T20:35:00Z"));

      expect(stats).toEqual({
        firstJoinedAt: new Date("2026-08-16T19:02:00Z"),
        latenessMs: 2 * 60 * 1000,
        totalDurationMs: 58 * 60 * 1000 + 30 * 60 * 1000,
        sessionCount: 2,
      });
    });

    it("computes an open session's duration against asOf", () => {
      const startedAt = new Date("2026-08-16T19:00:00Z");
      const sessions = [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: null, source: "EVENT" as const }];

      const stats = service.computeAttendanceStats(sessions, startedAt, new Date("2026-08-16T19:10:00Z"));

      expect(stats?.totalDurationMs).toBe(10 * 60 * 1000);
    });

    it("never returns negative lateness for someone present at the exact start", () => {
      const startedAt = new Date("2026-08-16T19:00:00Z");
      const sessions = [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: null, source: "EVENT" as const }];

      const stats = service.computeAttendanceStats(sessions, startedAt, startedAt);
      expect(stats?.latenessMs).toBe(0);
    });
  });

  describe("computeMeetingDurationMs", () => {
    it("excludes a closed paused interval from the total", () => {
      const meeting = {
        startedAt: new Date("2026-08-16T19:00:00Z"),
        endedAt: new Date("2026-08-16T20:00:00Z"),
        pauses: [{ pausedAt: new Date("2026-08-16T19:20:00Z"), resumedAt: new Date("2026-08-16T19:30:00Z") }],
      };

      // 60 minutes wall clock minus 10 minutes paused = 50 minutes.
      expect(service.computeMeetingDurationMs(meeting, meeting.endedAt)).toBe(50 * 60 * 1000);
    });

    it("counts a still-open pause as paused through asOf", () => {
      const meeting = {
        startedAt: new Date("2026-08-16T19:00:00Z"),
        endedAt: null,
        pauses: [{ pausedAt: new Date("2026-08-16T19:20:00Z"), resumedAt: null }],
      };
      const asOf = new Date("2026-08-16T19:30:00Z");

      // 30 minutes wall clock minus 10 minutes paused (still open) = 20 minutes.
      expect(service.computeMeetingDurationMs(meeting, asOf)).toBe(20 * 60 * 1000);
    });
  });

  describe("freezeStats", () => {
    it("persists frozen stats that match what the live calculation would return at the same instant", async () => {
      const startedAt = new Date("2026-08-16T19:00:00Z");
      const endedAt = new Date("2026-08-16T20:35:00Z");

      const meeting = await meetingModel.create({
        guildId: "guild-1",
        meetingType: "000000000000000000000001",
        voiceChannelIds: ["channel-1"],
        status: "COMPLETED",
        startedBy: "manager-1",
        startedAt,
        endedBy: "manager-1",
        endedAt,
        cancelReason: null,
        pauses: [],
        expectedMembers: [
          { discordUserId: "user-1", usernameSnapshot: "aymen", roleIds: [] },
          { discordUserId: "user-2", usernameSnapshot: "sami", roleIds: [] },
        ],
        summary: null,
        summaryUpdatedBy: null,
        summaryUpdatedAt: null,
        stats: null,
        lastActivityAt: startedAt,
      });

      const attendance = await attendanceModel.create({
        meeting: meeting._id,
        discordUserId: "user-1",
        usernameSnapshot: "aymen",
        displayNameSnapshot: "Aymen",
        expected: true,
        sessions: [{ joinedAt: new Date("2026-08-16T19:02:00Z"), leftAt: endedAt, source: "EVENT" }],
        manuallyEdited: false,
        editedBy: null,
        stats: null,
      });

      // Compute the "live" answer right before freezing, at the same instant.
      const liveAttendanceStats = service.computeAttendanceStats(attendance.sessions, startedAt, endedAt);
      const liveMeetingStats = service.computeMeetingStats(meeting, [attendance], endedAt);

      await service.freezeStats(meeting._id.toString(), endedAt);

      const frozenAttendance = await attendanceModel.findById(attendance._id);
      const frozenMeeting = await meetingModel.findById(meeting._id);

      // Mongoose subdocuments carry internal metadata; .toObject() (typed loosely
      // here since these fields are typed as plain classes) strips it for a clean comparison.
      expect((frozenAttendance?.stats as unknown as { toObject(): unknown })?.toObject()).toEqual(liveAttendanceStats);
      expect((frozenMeeting?.stats as unknown as { toObject(): unknown })?.toObject()).toEqual(liveMeetingStats);
      // user-2 never showed up — sami is an absentee, not counted as present.
      expect(frozenMeeting?.stats?.presentCount).toBe(1);
      expect(frozenMeeting?.stats?.expectedCount).toBe(2);
    });
  });
});
