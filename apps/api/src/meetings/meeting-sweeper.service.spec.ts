import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Logger } from "nestjs-pino";
import { MeetingSweeperService } from "./meeting-sweeper.service.js";
import { Meeting, MeetingSchema } from "./schemas/meeting.schema.js";

describe("MeetingSweeperService", () => {
  let mongod: MongoMemoryServer;
  let sweeper: MeetingSweeperService;
  let meetingModel: Model<Meeting>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongod.getUri()), MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }])],
      providers: [
        MeetingSweeperService,
        { provide: Logger, useValue: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } },
      ],
    }).compile();

    sweeper = moduleRef.get(MeetingSweeperService);
    meetingModel = moduleRef.get(getModelToken(Meeting.name));
  });

  afterEach(async () => {
    await meetingModel.deleteMany({});
  });

  afterAll(async () => {
    await meetingModel.db.close();
    await mongod.stop();
  });

  const baseMeeting = {
    guildId: "guild-1",
    meetingType: "000000000000000000000001",
    startedBy: "manager-1",
    endedBy: null,
    endedAt: null,
    cancelReason: null,
    pauses: [],
    expectedMembers: [],
    summary: null,
    summaryUpdatedBy: null,
    summaryUpdatedAt: null,
    stats: null,
  };

  it("ends an ACTIVE meeting past the 12-hour hard cap, backdating endedAt to exactly +12h", async () => {
    const startedAt = new Date(Date.now() - 13 * 60 * 60 * 1000);
    const meeting = await meetingModel.create({
      ...baseMeeting,
      voiceChannelIds: ["channel-hardcap"],
      status: "ACTIVE",
      startedAt,
      lastActivityAt: startedAt,
    });

    await sweeper.sweep();

    const swept = await meetingModel.findById(meeting._id);
    expect(swept?.status).toBe("COMPLETED");
    expect(swept?.endedBy).toBe("SYSTEM");
    expect(swept?.endedAt).toEqual(new Date(startedAt.getTime() + 12 * 60 * 60 * 1000));
  });

  it("hard-caps a PAUSED meeting too", async () => {
    const startedAt = new Date(Date.now() - 13 * 60 * 60 * 1000);
    const meeting = await meetingModel.create({
      ...baseMeeting,
      voiceChannelIds: ["channel-hardcap-paused"],
      status: "PAUSED",
      startedAt,
      lastActivityAt: startedAt,
      pauses: [{ pausedAt: startedAt, resumedAt: null }],
    });

    await sweeper.sweep();

    const swept = await meetingModel.findById(meeting._id);
    expect(swept?.status).toBe("COMPLETED");
  });

  it("does not touch a fresh ACTIVE meeting", async () => {
    const startedAt = new Date();
    const meeting = await meetingModel.create({
      ...baseMeeting,
      voiceChannelIds: ["channel-fresh"],
      status: "ACTIVE",
      startedAt,
      lastActivityAt: startedAt,
    });

    await sweeper.sweep();

    const untouched = await meetingModel.findById(meeting._id);
    expect(untouched?.status).toBe("ACTIVE");
  });

  it("ends an ACTIVE meeting whose channel has been empty for 15+ minutes, backdating endedAt to the last activity", async () => {
    const startedAt = new Date(Date.now() - 60 * 60 * 1000);
    const lastActivityAt = new Date(Date.now() - 20 * 60 * 1000);
    const meeting = await meetingModel.create({
      ...baseMeeting,
      voiceChannelIds: ["channel-empty"],
      status: "ACTIVE",
      startedAt,
      lastActivityAt,
    });

    await sweeper.sweep();

    const swept = await meetingModel.findById(meeting._id);
    expect(swept?.status).toBe("COMPLETED");
    expect(swept?.endedBy).toBe("SYSTEM");
    expect(swept?.endedAt).toEqual(lastActivityAt);
  });

  it("does not sweep a PAUSED meeting for emptiness — pausing is a deliberate choice, not abandonment", async () => {
    const startedAt = new Date(Date.now() - 60 * 60 * 1000);
    const lastActivityAt = new Date(Date.now() - 20 * 60 * 1000);
    const meeting = await meetingModel.create({
      ...baseMeeting,
      voiceChannelIds: ["channel-paused-quiet"],
      status: "PAUSED",
      startedAt,
      lastActivityAt,
      pauses: [{ pausedAt: lastActivityAt, resumedAt: null }],
    });

    await sweeper.sweep();

    const untouched = await meetingModel.findById(meeting._id);
    expect(untouched?.status).toBe("PAUSED");
  });

  it("does not sweep an ACTIVE meeting with recent activity", async () => {
    const startedAt = new Date(Date.now() - 60 * 60 * 1000);
    const lastActivityAt = new Date(Date.now() - 5 * 60 * 1000);
    const meeting = await meetingModel.create({
      ...baseMeeting,
      voiceChannelIds: ["channel-recent"],
      status: "ACTIVE",
      startedAt,
      lastActivityAt,
    });

    await sweeper.sweep();

    const untouched = await meetingModel.findById(meeting._id);
    expect(untouched?.status).toBe("ACTIVE");
  });
});
