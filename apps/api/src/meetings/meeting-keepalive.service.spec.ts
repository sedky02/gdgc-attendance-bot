import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Logger } from "nestjs-pino";
import { MeetingKeepAliveService } from "./meeting-keepalive.service.js";
import { Meeting, MeetingSchema } from "./schemas/meeting.schema.js";

const BOT_URL = "https://bot.example.com";
const API_URL = "https://api.example.com/health";

describe("MeetingKeepAliveService", () => {
  let mongod: MongoMemoryServer;
  let service: MeetingKeepAliveService;
  let meetingModel: Model<Meeting>;
  let config: Record<string, string | undefined>;
  const warn = vi.fn();
  const fetchMock = vi.fn();

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    config = { BOT_HEALTH_URL: BOT_URL, API_PUBLIC_URL: API_URL };

    const moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongod.getUri()), MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }])],
      providers: [
        MeetingKeepAliveService,
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        { provide: Logger, useValue: { log: vi.fn(), error: vi.fn(), warn } },
      ],
    }).compile();

    service = moduleRef.get(MeetingKeepAliveService);
    meetingModel = moduleRef.get(getModelToken(Meeting.name));
  });

  beforeEach(() => {
    config.BOT_HEALTH_URL = BOT_URL;
    config.API_PUBLIC_URL = API_URL;
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    warn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await meetingModel.deleteMany({});
  });

  afterAll(async () => {
    await meetingModel.db.close();
    await mongod.stop();
  });

  const createMeeting = (status: "ACTIVE" | "PAUSED" | "COMPLETED", channel: string) => {
    const startedAt = new Date();
    return meetingModel.create({
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
      voiceChannelIds: [channel],
      status,
      startedAt,
      lastActivityAt: startedAt,
    });
  };

  it("pings the bot and the API itself while a meeting is ACTIVE", async () => {
    await createMeeting("ACTIVE", "channel-active");

    await service.keepAlive();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([API_URL, BOT_URL].sort());
  });

  it("keeps pinging while a meeting is PAUSED", async () => {
    await createMeeting("PAUSED", "channel-paused");

    await service.keepAlive();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no meeting is live, so the services can sleep", async () => {
    await createMeeting("COMPLETED", "channel-done");

    await service.keepAlive();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when no URLs are configured", async () => {
    config.BOT_HEALTH_URL = undefined;
    config.API_PUBLIC_URL = undefined;
    await createMeeting("ACTIVE", "channel-nourl");

    await service.keepAlive();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pings only the configured URL", async () => {
    config.API_PUBLIC_URL = undefined;
    await createMeeting("ACTIVE", "channel-botonly");

    await service.keepAlive();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(BOT_URL);
  });

  it("logs and carries on when one ping fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ ok: true });
    await createMeeting("ACTIVE", "channel-fail");

    await expect(service.keepAlive()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
