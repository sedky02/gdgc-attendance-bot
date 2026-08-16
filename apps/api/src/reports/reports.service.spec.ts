import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { ReportsService } from "./reports.service.js";
import { AttendanceStatsService } from "../attendance/attendance-stats.service.js";
import { Attendance, AttendanceSchema } from "../attendance/schemas/attendance.schema.js";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";

describe("ReportsService", () => {
  let mongod: MongoMemoryServer;
  let service: ReportsService;
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
      providers: [ReportsService, AttendanceStatsService],
    }).compile();

    service = moduleRef.get(ReportsService);
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

  it("throws NotFoundException for an unknown meeting", async () => {
    await expect(service.getReport(new Types.ObjectId().toString())).rejects.toBeInstanceOf(NotFoundException);
  });

  it("assembles the report from meeting + attendance + absentees derived from the expectedMembers snapshot", async () => {
    const meeting = await meetingModel.create({
      guildId: "guild-1",
      meetingType: "000000000000000000000001",
      voiceChannelIds: ["channel-1"],
      status: "COMPLETED",
      startedBy: "manager-1",
      startedAt: new Date("2026-08-16T19:00:00Z"),
      endedBy: "manager-1",
      endedAt: new Date("2026-08-16T20:35:00Z"),
      cancelReason: null,
      pauses: [{ pausedAt: new Date("2026-08-16T19:20:00Z"), resumedAt: new Date("2026-08-16T19:30:00Z") }],
      expectedMembers: [
        { discordUserId: "user-1", usernameSnapshot: "aymen", roleIds: [] },
        { discordUserId: "user-2", usernameSnapshot: "sami", roleIds: [] },
      ],
      summary: null,
      summaryUpdatedBy: null,
      summaryUpdatedAt: null,
      // Frozen already (COMPLETED), so the report must use these, not recompute.
      stats: { presentCount: 1, expectedCount: 2, unexpectedCount: 0, durationMs: 5_400_000 },
      lastActivityAt: new Date("2026-08-16T19:00:00Z"),
    });

    await attendanceModel.create({
      meeting: meeting._id,
      discordUserId: "user-1",
      usernameSnapshot: "aymen",
      displayNameSnapshot: "Aymen",
      expected: true,
      sessions: [{ joinedAt: new Date("2026-08-16T19:02:00Z"), leftAt: new Date("2026-08-16T19:20:00Z"), source: "EVENT" }],
      manuallyEdited: false,
      editedBy: null,
      stats: { firstJoinedAt: new Date("2026-08-16T19:02:00Z"), latenessMs: 120_000, totalDurationMs: 1_080_000, sessionCount: 1 },
    });
    // user-2 (sami) never showed up — this is the absentee case.

    const report = await service.getReport(meeting._id.toString());

    expect(report.meeting.stats).toEqual({ presentCount: 1, expectedCount: 2, unexpectedCount: 0, durationMs: 5_400_000 });
    expect(report.attendance).toHaveLength(1);
    expect(report.attendance[0].discordUserId).toBe("user-1");
    expect(report.absentees).toEqual([{ discordUserId: "user-2", usernameSnapshot: "sami", roleIds: [] }]);
  });

  it("computes stats live (not frozen) for a still-ACTIVE meeting", async () => {
    const meeting = await meetingModel.create({
      guildId: "guild-1",
      meetingType: "000000000000000000000001",
      voiceChannelIds: ["channel-2"],
      status: "ACTIVE",
      startedBy: "manager-1",
      startedAt: new Date("2026-08-16T19:00:00Z"),
      endedBy: null,
      endedAt: null,
      cancelReason: null,
      pauses: [],
      expectedMembers: [],
      summary: null,
      summaryUpdatedBy: null,
      summaryUpdatedAt: null,
      stats: null,
      lastActivityAt: new Date("2026-08-16T19:00:00Z"),
    });

    await attendanceModel.create({
      meeting: meeting._id,
      discordUserId: "user-1",
      usernameSnapshot: "aymen",
      displayNameSnapshot: "Aymen",
      expected: false,
      sessions: [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: null, source: "EVENT" }],
      manuallyEdited: false,
      editedBy: null,
      stats: null,
    });

    const report = await service.getReport(meeting._id.toString());

    expect(report.meeting.stats).not.toBeNull();
    expect(report.attendance[0].stats).not.toBeNull();
    expect(report.attendance[0].stats?.sessionCount).toBe(1);
  });
});
