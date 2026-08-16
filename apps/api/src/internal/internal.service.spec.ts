import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { InternalService } from "./internal.service.js";
import { MeetingLifecycleService } from "../meetings/meeting-lifecycle.service.js";
import { MeetingTypesService } from "../meeting-types/meeting-types.service.js";
import { AttendanceResolverService } from "../attendance/attendance-resolver.service.js";
import { AttendanceStatsService } from "../attendance/attendance-stats.service.js";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";
import { MeetingType, MeetingTypeSchema } from "../meeting-types/schemas/meeting-type.schema.js";
import { Attendance, AttendanceSchema } from "../attendance/schemas/attendance.schema.js";

describe("InternalService", () => {
  let mongod: MongoMemoryServer;
  let internalService: InternalService;
  let meetingLifecycleService: MeetingLifecycleService;
  let meetingTypesService: MeetingTypesService;
  let meetingModel: Model<Meeting>;
  let attendanceModel: Model<Attendance>;
  let meetingTypeModel: Model<MeetingType>;

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
      providers: [InternalService, MeetingLifecycleService, MeetingTypesService, AttendanceResolverService, AttendanceStatsService],
    }).compile();

    internalService = moduleRef.get(InternalService);
    meetingLifecycleService = moduleRef.get(MeetingLifecycleService);
    meetingTypesService = moduleRef.get(MeetingTypesService);
    meetingModel = moduleRef.get(getModelToken(Meeting.name));
    attendanceModel = moduleRef.get(getModelToken(Attendance.name));
    meetingTypeModel = moduleRef.get(getModelToken(MeetingType.name));
  });

  afterEach(async () => {
    await meetingModel.deleteMany({});
    await attendanceModel.deleteMany({});
    await meetingTypeModel.deleteMany({});
  });

  afterAll(async () => {
    await meetingModel.db.close();
    await mongod.stop();
  });

  async function startMeeting(voiceChannelIds: string[], guildId = "guild-1") {
    const type = await meetingTypesService.create({ guildId, name: "Weekly", roles: [], createdBy: "manager-1" });
    return meetingLifecycleService.start({
      guildId,
      meetingTypeId: type.id,
      voiceChannelIds,
      startedBy: "manager-1",
      expectedMembers: [],
      presentMembers: [],
      observedAt: new Date("2026-08-16T19:00:00Z"),
    });
  }

  const aymen = { discordUserId: "user-1", usernameSnapshot: "aymen", displayNameSnapshot: "Aymen" };

  describe("handleVoiceEvent", () => {
    it("a join event (to set, from null) opens a session in the target meeting", async () => {
      const meeting = await startMeeting(["channel-a"]);

      await internalService.handleVoiceEvent({
        guildId: "guild-1",
        ...aymen,
        from: null,
        to: "channel-a",
        occurredAt: new Date("2026-08-16T19:05:00Z"),
      });

      const doc = await attendanceModel.findOne({ meeting: meeting.id, discordUserId: aymen.discordUserId });
      expect(doc?.sessions[0].leftAt).toBeNull();
    });

    it("a leave event (from set, to null) closes the session in the source meeting", async () => {
      const meeting = await startMeeting(["channel-a"]);
      await internalService.handleVoiceEvent({
        guildId: "guild-1",
        ...aymen,
        from: null,
        to: "channel-a",
        occurredAt: new Date("2026-08-16T19:05:00Z"),
      });

      await internalService.handleVoiceEvent({
        guildId: "guild-1",
        ...aymen,
        from: "channel-a",
        to: null,
        occurredAt: new Date("2026-08-16T19:30:00Z"),
      });

      const doc = await attendanceModel.findOne({ meeting: meeting.id, discordUserId: aymen.discordUserId });
      expect(doc?.sessions[0].leftAt).toEqual(new Date("2026-08-16T19:30:00Z"));
    });

    it("a channel move (single event, from and to both set) closes one meeting and opens the other", async () => {
      const meetingA = await startMeeting(["channel-a"]);
      const meetingB = await startMeeting(["channel-b"]);

      await internalService.handleVoiceEvent({
        guildId: "guild-1",
        ...aymen,
        from: null,
        to: "channel-a",
        occurredAt: new Date("2026-08-16T19:05:00Z"),
      });

      const moveAt = new Date("2026-08-16T19:15:00Z");
      await internalService.handleVoiceEvent({
        guildId: "guild-1",
        ...aymen,
        from: "channel-a",
        to: "channel-b",
        occurredAt: moveAt,
      });

      const inA = await attendanceModel.findOne({ meeting: meetingA.id, discordUserId: aymen.discordUserId });
      const inB = await attendanceModel.findOne({ meeting: meetingB.id, discordUserId: aymen.discordUserId });

      expect(inA?.sessions[0].leftAt).toEqual(moveAt);
      expect(inB?.sessions[0].leftAt).toBeNull();
    });

    it("is a no-op for a channel with no tracked meeting", async () => {
      await expect(
        internalService.handleVoiceEvent({
          guildId: "guild-1",
          ...aymen,
          from: null,
          to: "channel-untracked",
          occurredAt: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe("bootstrap", () => {
    it("lists live meetings across all guilds, for the bot's post-restart discovery", async () => {
      const meetingGuild1 = await startMeeting(["channel-a"], "guild-1");
      const meetingGuild2 = await startMeeting(["channel-b"], "guild-2");

      const live = await internalService.bootstrap();
      const ids = live.map((m) => m.id);

      expect(ids).toContain(meetingGuild1.id);
      expect(ids).toContain(meetingGuild2.id);
    });
  });
});
