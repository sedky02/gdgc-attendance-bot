import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { MeetingLifecycleService } from "./meeting-lifecycle.service.js";
import { MeetingTypesService } from "../meeting-types/meeting-types.service.js";
import { AttendanceResolverService } from "../attendance/attendance-resolver.service.js";
import { AttendanceStatsService } from "../attendance/attendance-stats.service.js";
import { Meeting, MeetingSchema } from "./schemas/meeting.schema.js";
import { MeetingType, MeetingTypeSchema } from "../meeting-types/schemas/meeting-type.schema.js";
import { Attendance, AttendanceSchema } from "../attendance/schemas/attendance.schema.js";

describe("MeetingLifecycleService", () => {
  let mongod: MongoMemoryServer;
  let service: MeetingLifecycleService;
  let meetingTypesService: MeetingTypesService;
  let meetingModel: Model<Meeting>;
  let meetingTypeModel: Model<MeetingType>;
  let attendanceModel: Model<Attendance>;
  let meetingTypeId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Meeting.name, schema: MeetingSchema },
          { name: MeetingType.name, schema: MeetingTypeSchema },
          { name: Attendance.name, schema: AttendanceSchema },
        ]),
      ],
      providers: [MeetingLifecycleService, MeetingTypesService, AttendanceResolverService, AttendanceStatsService],
    }).compile();

    service = moduleRef.get(MeetingLifecycleService);
    meetingTypesService = moduleRef.get(MeetingTypesService);
    meetingModel = moduleRef.get(getModelToken(Meeting.name));
    meetingTypeModel = moduleRef.get(getModelToken(MeetingType.name));
    attendanceModel = moduleRef.get(getModelToken(Attendance.name));
  });

  beforeEach(async () => {
    const type = await meetingTypesService.create({
      guildId: "guild-1",
      name: "Weekly Technical Meeting",
      roles: [{ roleId: "role-1", nameSnapshot: "Member" }],
      createdBy: "manager-1",
    });
    meetingTypeId = type.id;
  });

  afterEach(async () => {
    await meetingModel.deleteMany({});
    await meetingTypeModel.deleteMany({});
    await attendanceModel.deleteMany({});
  });

  afterAll(async () => {
    await meetingModel.db.close();
    await mongod.stop();
  });

  const startDto = (overrides: Partial<Parameters<MeetingLifecycleService["start"]>[0]> = {}) => ({
    guildId: "guild-1",
    meetingTypeId,
    voiceChannelIds: ["channel-1"],
    startedBy: "manager-1",
    expectedMembers: [{ discordUserId: "user-1", usernameSnapshot: "aymen", roleIds: ["role-1"] }],
    presentMembers: [],
    observedAt: new Date("2026-08-16T19:00:00Z"),
    ...overrides,
  });

  describe("start", () => {
    it("creates an ACTIVE meeting with expectedMembers snapshotted", async () => {
      const meeting = await service.start(startDto());

      expect(meeting.status).toBe("ACTIVE");
      expect(meeting.expectedMembers).toEqual([{ discordUserId: "user-1", usernameSnapshot: "aymen", roleIds: ["role-1"] }]);
    });

    it("opens sessions for whoever is already present when the meeting starts", async () => {
      const meeting = await service.start(
        startDto({ presentMembers: [{ discordUserId: "user-1", usernameSnapshot: "aymen", displayNameSnapshot: "Aymen" }] }),
      );

      const doc = await attendanceModel.findOne({ meeting: meeting.id, discordUserId: "user-1" });
      expect(doc?.sessions[0]).toMatchObject({ leftAt: null });
      expect(doc?.expected).toBe(true);
    });

    it("throws NotFoundException for an unknown meeting type", async () => {
      const fakeTypeId = new Types.ObjectId().toString();
      await expect(service.start(startDto({ meetingTypeId: fakeTypeId }))).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ConflictException when the meeting type is archived", async () => {
      await meetingTypesService.archive(meetingTypeId);
      await expect(service.start(startDto())).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws a 409 for a second ACTIVE meeting on the same channel", async () => {
      await service.start(startDto());
      await expect(service.start(startDto())).rejects.toBeInstanceOf(ConflictException);
    });

    it("allows a new meeting once the channel's previous meeting has ended", async () => {
      const first = await service.start(startDto());
      await service.end(first.id, { endedBy: "manager-1", observedAt: new Date("2026-08-16T20:00:00Z") });

      await expect(service.start(startDto({ observedAt: new Date("2026-08-16T21:00:00Z") }))).resolves.toBeDefined();
    });
  });

  describe("pause / resume", () => {
    it("pausing records a pauses[] entry with resumedAt null", async () => {
      const meeting = await service.start(startDto());
      const paused = await service.pause(meeting.id, { pausedBy: "manager-1", observedAt: new Date("2026-08-16T19:30:00Z") });

      expect(paused.status).toBe("PAUSED");
      expect(paused.pauses).toEqual([{ pausedAt: new Date("2026-08-16T19:30:00Z"), resumedAt: null }]);
    });

    it("resuming closes the open pause entry", async () => {
      const meeting = await service.start(startDto());
      await service.pause(meeting.id, { pausedBy: "manager-1", observedAt: new Date("2026-08-16T19:30:00Z") });
      const resumed = await service.resume(meeting.id, {
        resumedBy: "manager-1",
        observedAt: new Date("2026-08-16T19:35:00Z"),
        presentMembers: [],
      });

      expect(resumed.status).toBe("ACTIVE");
      expect(resumed.pauses).toEqual([
        { pausedAt: new Date("2026-08-16T19:30:00Z"), resumedAt: new Date("2026-08-16T19:35:00Z") },
      ]);
    });

    it("rejects pausing a meeting that is already PAUSED", async () => {
      const meeting = await service.start(startDto());
      await service.pause(meeting.id, { pausedBy: "manager-1", observedAt: new Date() });

      await expect(service.pause(meeting.id, { pausedBy: "manager-1", observedAt: new Date() })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("rejects resuming a meeting that is ACTIVE", async () => {
      const meeting = await service.start(startDto());

      await expect(
        service.resume(meeting.id, { resumedBy: "manager-1", observedAt: new Date(), presentMembers: [] }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("pausing closes every open session so it never spans the pause", async () => {
      const meeting = await service.start(startDto());
      await attendanceModel.create({
        meeting: meeting.id,
        discordUserId: "user-1",
        usernameSnapshot: "aymen",
        displayNameSnapshot: "Aymen",
        expected: true,
        sessions: [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: null, source: "EVENT" }],
        manuallyEdited: false,
        editedBy: null,
        stats: null,
      });

      await service.pause(meeting.id, { pausedBy: "manager-1", observedAt: new Date("2026-08-16T19:30:00Z") });

      const doc = await attendanceModel.findOne({ meeting: meeting.id, discordUserId: "user-1" });
      expect(doc?.sessions[0].leftAt).toEqual(new Date("2026-08-16T19:30:00Z"));
    });

    it("resuming opens fresh sessions for whoever the bot reports as currently present", async () => {
      const meeting = await service.start(startDto());
      await service.pause(meeting.id, { pausedBy: "manager-1", observedAt: new Date("2026-08-16T19:30:00Z") });

      await service.resume(meeting.id, {
        resumedBy: "manager-1",
        observedAt: new Date("2026-08-16T19:35:00Z"),
        presentMembers: [{ discordUserId: "user-2", usernameSnapshot: "sami", displayNameSnapshot: "Sami" }],
      });

      const doc = await attendanceModel.findOne({ meeting: meeting.id, discordUserId: "user-2" });
      expect(doc?.sessions.map((s) => ({ joinedAt: s.joinedAt, leftAt: s.leftAt, source: s.source }))).toEqual([
        { joinedAt: new Date("2026-08-16T19:35:00Z"), leftAt: null, source: "EVENT" },
      ]);
    });
  });

  describe("end / cancel", () => {
    it("ends an ACTIVE meeting", async () => {
      const meeting = await service.start(startDto());
      const ended = await service.end(meeting.id, { endedBy: "manager-1", observedAt: new Date("2026-08-16T20:35:00Z") });

      expect(ended.status).toBe("COMPLETED");
      expect(ended.endedBy).toBe("manager-1");
      expect(ended.endedAt).toEqual(new Date("2026-08-16T20:35:00Z"));
    });

    it("freezes meeting and attendance stats on end", async () => {
      const meeting = await service.start(
        startDto({ presentMembers: [{ discordUserId: "user-1", usernameSnapshot: "aymen", displayNameSnapshot: "Aymen" }] }),
      );

      const ended = await service.end(meeting.id, { endedBy: "manager-1", observedAt: new Date("2026-08-16T20:35:00Z") });

      expect(ended.stats).toEqual({
        presentCount: 1,
        expectedCount: 1,
        unexpectedCount: 0,
        durationMs: new Date("2026-08-16T20:35:00Z").getTime() - new Date("2026-08-16T19:00:00Z").getTime(),
      });

      const doc = await attendanceModel.findOne({ meeting: meeting.id, discordUserId: "user-1" });
      expect(doc?.stats?.sessionCount).toBe(1);
      expect(doc?.stats?.totalDurationMs).toBe(
        new Date("2026-08-16T20:35:00Z").getTime() - new Date("2026-08-16T19:00:00Z").getTime(),
      );
    });

    it("ends a PAUSED meeting", async () => {
      const meeting = await service.start(startDto());
      await service.pause(meeting.id, { pausedBy: "manager-1", observedAt: new Date() });

      const ended = await service.end(meeting.id, { endedBy: "manager-1", observedAt: new Date() });
      expect(ended.status).toBe("COMPLETED");
    });

    it("rejects ending an already-COMPLETED meeting with a readable error", async () => {
      const meeting = await service.start(startDto());
      await service.end(meeting.id, { endedBy: "manager-1", observedAt: new Date() });

      await expect(service.end(meeting.id, { endedBy: "manager-1", observedAt: new Date() })).rejects.toThrow(
        /Cannot end a meeting that is COMPLETED/,
      );
    });

    it("cancels an ACTIVE meeting with a reason and no report-worthy stats", async () => {
      const meeting = await service.start(startDto());
      const cancelled = await service.cancel(meeting.id, {
        cancelledBy: "manager-1",
        cancelReason: "Wrong channel",
        observedAt: new Date(),
      });

      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.cancelReason).toBe("Wrong channel");
    });

    it("rejects cancelling an already-CANCELLED meeting", async () => {
      const meeting = await service.start(startDto());
      await service.cancel(meeting.id, { cancelledBy: "manager-1", cancelReason: "test", observedAt: new Date() });

      await expect(
        service.cancel(meeting.id, { cancelledBy: "manager-1", cancelReason: "test", observedAt: new Date() }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws NotFoundException for an unknown meeting id on any transition", async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(service.end(fakeId, { endedBy: "manager-1", observedAt: new Date() })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("listActive", () => {
    it("includes ACTIVE and PAUSED meetings but not COMPLETED or CANCELLED", async () => {
      const active = await service.start(startDto({ voiceChannelIds: ["channel-active"] }));
      const paused = await service.start(startDto({ voiceChannelIds: ["channel-paused"] }));
      await service.pause(paused.id, { pausedBy: "manager-1", observedAt: new Date() });
      const completed = await service.start(startDto({ voiceChannelIds: ["channel-completed"] }));
      await service.end(completed.id, { endedBy: "manager-1", observedAt: new Date() });

      const listed = await service.listActive("guild-1");
      const ids = listed.map((m) => m.id);

      expect(ids).toContain(active.id);
      expect(ids).toContain(paused.id);
      expect(ids).not.toContain(completed.id);
    });
  });

  describe("session cleanup on end/cancel", () => {
    it("end closes any still-open session so no record outlives the meeting", async () => {
      const meeting = await service.start(startDto());
      await attendanceModel.create({
        meeting: meeting.id,
        discordUserId: "user-1",
        usernameSnapshot: "aymen",
        displayNameSnapshot: "Aymen",
        expected: true,
        sessions: [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: null, source: "EVENT" }],
        manuallyEdited: false,
        editedBy: null,
        stats: null,
      });

      await service.end(meeting.id, { endedBy: "manager-1", observedAt: new Date("2026-08-16T20:35:00Z") });

      const doc = await attendanceModel.findOne({ meeting: meeting.id, discordUserId: "user-1" });
      expect(doc?.sessions[0].leftAt).toEqual(new Date("2026-08-16T20:35:00Z"));
    });

    it("cancel closes any still-open session too", async () => {
      const meeting = await service.start(startDto());
      await attendanceModel.create({
        meeting: meeting.id,
        discordUserId: "user-1",
        usernameSnapshot: "aymen",
        displayNameSnapshot: "Aymen",
        expected: true,
        sessions: [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: null, source: "EVENT" }],
        manuallyEdited: false,
        editedBy: null,
        stats: null,
      });

      await service.cancel(meeting.id, { cancelledBy: "manager-1", cancelReason: "test", observedAt: new Date("2026-08-16T19:45:00Z") });

      const doc = await attendanceModel.findOne({ meeting: meeting.id, discordUserId: "user-1" });
      expect(doc?.sessions[0].leftAt).toEqual(new Date("2026-08-16T19:45:00Z"));
    });
  });
});
