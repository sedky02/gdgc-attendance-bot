import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceStatsService } from "./attendance-stats.service.js";
import { Attendance, AttendanceSchema } from "./schemas/attendance.schema.js";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";

describe("AttendanceService", () => {
  let mongod: MongoMemoryServer;
  let service: AttendanceService;
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
      providers: [AttendanceService, AttendanceStatsService],
    }).compile();

    service = moduleRef.get(AttendanceService);
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

  async function createMeeting(status: string, extra: Partial<{ endedAt: Date | null }> = {}) {
    const doc = await meetingModel.create({
      guildId: "guild-1",
      meetingType: "000000000000000000000001",
      voiceChannelIds: ["channel-1"],
      status,
      startedBy: "manager-1",
      startedAt: new Date("2026-08-16T19:00:00Z"),
      endedBy: status === "COMPLETED" ? "manager-1" : null,
      endedAt: extra.endedAt ?? (status === "COMPLETED" ? new Date("2026-08-16T20:35:00Z") : null),
      cancelReason: null,
      pauses: [],
      expectedMembers: [{ discordUserId: "user-1", usernameSnapshot: "aymen", roleIds: [] }],
      summary: null,
      summaryUpdatedBy: null,
      summaryUpdatedAt: null,
      stats: null,
      lastActivityAt: new Date("2026-08-16T19:00:00Z"),
    });
    return doc._id.toString();
  }

  describe("manualCorrection", () => {
    it("creates a brand-new attendance record for someone the bot never saw (fully missed outage)", async () => {
      const meetingId = await createMeeting("ACTIVE");

      const created = await service.manualCorrection(meetingId, {
        discordUserId: "user-1",
        usernameSnapshot: "aymen",
        displayNameSnapshot: "Aymen",
        sessions: [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: new Date("2026-08-16T20:00:00Z"), source: "MANUAL" }],
        editedBy: "manager-1",
      });

      expect(created.manuallyEdited).toBe(true);
      expect(created.editedBy).toBe("manager-1");
      expect(created.expected).toBe(true);
    });

    it("re-freezes both attendance and meeting stats when correcting an already-completed meeting", async () => {
      const meetingId = await createMeeting("COMPLETED");

      await service.manualCorrection(meetingId, {
        discordUserId: "user-1",
        usernameSnapshot: "aymen",
        displayNameSnapshot: "Aymen",
        sessions: [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: new Date("2026-08-16T20:35:00Z"), source: "MANUAL" }],
        editedBy: "manager-1",
      });

      const meeting = await meetingModel.findById(meetingId);
      const attendance = await attendanceModel.findOne({ meeting: meetingId, discordUserId: "user-1" });

      expect(meeting?.stats?.presentCount).toBe(1);
      expect(attendance?.stats?.totalDurationMs).toBe(95 * 60 * 1000);
    });

    it("throws NotFoundException for an unknown meeting", async () => {
      await expect(
        service.manualCorrection(new Types.ObjectId().toString(), {
          discordUserId: "user-1",
          usernameSnapshot: "aymen",
          displayNameSnapshot: "Aymen",
          sessions: [],
          editedBy: "manager-1",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("updateSession", () => {
    it("edits an existing attendance document's sessions and marks it manually edited", async () => {
      const meetingId = await createMeeting("ACTIVE");
      const doc = await attendanceModel.create({
        meeting: meetingId,
        discordUserId: "user-1",
        usernameSnapshot: "aymen",
        displayNameSnapshot: "Aymen",
        expected: true,
        sessions: [{ joinedAt: new Date("2026-08-16T19:05:00Z"), leftAt: null, source: "EVENT" }],
        manuallyEdited: false,
        editedBy: null,
        stats: null,
      });

      const updated = await service.updateSession(doc._id.toString(), {
        sessions: [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: new Date("2026-08-16T19:30:00Z"), source: "MANUAL" }],
        editedBy: "manager-1",
      });

      expect(updated.manuallyEdited).toBe(true);
      expect(updated.sessions).toEqual([
        { joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: new Date("2026-08-16T19:30:00Z"), source: "MANUAL" },
      ]);
    });

    it("throws NotFoundException for an unknown attendance id", async () => {
      await expect(
        service.updateSession(new Types.ObjectId().toString(), { sessions: [], editedBy: "manager-1" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
