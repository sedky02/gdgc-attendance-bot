import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import { GuildOwnershipService } from "./guild-ownership.service.js";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema.js";
import { Attendance, AttendanceSchema } from "../attendance/schemas/attendance.schema.js";
import { MeetingType, MeetingTypeSchema } from "../meeting-types/schemas/meeting-type.schema.js";

describe("GuildOwnershipService", () => {
  let mongod: MongoMemoryServer;
  let service: GuildOwnershipService;
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
          { name: Attendance.name, schema: AttendanceSchema },
          { name: MeetingType.name, schema: MeetingTypeSchema },
        ]),
      ],
      providers: [GuildOwnershipService],
    }).compile();

    service = moduleRef.get(GuildOwnershipService);
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

  it("resolves a meeting's guild directly", async () => {
    const meeting = await meetingModel.create({
      guildId: "guild-1",
      meetingType: new Types.ObjectId(),
      voiceChannelIds: ["channel-1"],
      status: "ACTIVE",
      startedBy: "manager-1",
      startedAt: new Date(),
      endedBy: null,
      endedAt: null,
      cancelReason: null,
      pauses: [],
      expectedMembers: [],
      summary: null,
      summaryUpdatedBy: null,
      summaryUpdatedAt: null,
      stats: null,
      lastActivityAt: new Date(),
    });

    await expect(service.resolveOwnerGuildId("meeting", meeting._id.toString())).resolves.toBe("guild-1");
  });

  it("resolves an attendance doc's guild via its parent meeting", async () => {
    const meeting = await meetingModel.create({
      guildId: "guild-1",
      meetingType: new Types.ObjectId(),
      voiceChannelIds: ["channel-1"],
      status: "ACTIVE",
      startedBy: "manager-1",
      startedAt: new Date(),
      endedBy: null,
      endedAt: null,
      cancelReason: null,
      pauses: [],
      expectedMembers: [],
      summary: null,
      summaryUpdatedBy: null,
      summaryUpdatedAt: null,
      stats: null,
      lastActivityAt: new Date(),
    });
    const attendance = await attendanceModel.create({
      meeting: meeting._id,
      discordUserId: "user-1",
      usernameSnapshot: "aymen",
      displayNameSnapshot: "Aymen",
      expected: true,
      sessions: [],
      manuallyEdited: false,
      editedBy: null,
      stats: null,
    });

    await expect(service.resolveOwnerGuildId("attendance", attendance._id.toString())).resolves.toBe("guild-1");
  });

  it("resolves a meeting type's guild directly", async () => {
    const meetingType = await meetingTypeModel.create({
      guildId: "guild-1",
      name: "Weekly",
      roles: [],
      createdBy: "manager-1",
      archived: false,
    });

    await expect(service.resolveOwnerGuildId("meetingType", meetingType._id.toString())).resolves.toBe("guild-1");
  });

  it("returns undefined for a resource that doesn't exist", async () => {
    await expect(service.resolveOwnerGuildId("meeting", new Types.ObjectId().toString())).resolves.toBeUndefined();
  });

  it("returns undefined for a malformed id rather than throwing", async () => {
    await expect(service.resolveOwnerGuildId("meeting", "not-an-object-id")).resolves.toBeUndefined();
  });
});
