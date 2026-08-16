import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { Meeting, MeetingSchema } from "./meeting.schema.js";

describe("Meeting indexes", () => {
  let mongod: MongoMemoryServer;
  let MeetingModel: mongoose.Model<Meeting>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    MeetingModel = mongoose.model(Meeting.name, MeetingSchema);
    await MeetingModel.ensureIndexes();
  });

  afterEach(async () => {
    await MeetingModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  const baseMeeting = {
    guildId: "guild-1",
    meetingType: new Types.ObjectId(),
    voiceChannelIds: ["channel-1"],
    startedBy: "user-1",
    startedAt: new Date("2026-08-16T19:00:00Z"),
  };

  it("rejects a second ACTIVE meeting on the same channel", async () => {
    await MeetingModel.create({ ...baseMeeting, status: "ACTIVE" });

    await expect(MeetingModel.create({ ...baseMeeting, status: "ACTIVE" })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("rejects a PAUSED meeting on a channel that already has an ACTIVE one", async () => {
    await MeetingModel.create({ ...baseMeeting, status: "ACTIVE" });

    await expect(MeetingModel.create({ ...baseMeeting, status: "PAUSED" })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("allows a second COMPLETED meeting on the same channel", async () => {
    await MeetingModel.create({ ...baseMeeting, status: "COMPLETED" });

    await expect(MeetingModel.create({ ...baseMeeting, status: "COMPLETED" })).resolves.toBeDefined();
  });

  it("allows a new ACTIVE meeting once the previous one on that channel is completed", async () => {
    const first = await MeetingModel.create({ ...baseMeeting, status: "ACTIVE" });
    await MeetingModel.updateOne({ _id: first._id }, { status: "COMPLETED" });

    await expect(MeetingModel.create({ ...baseMeeting, status: "ACTIVE" })).resolves.toBeDefined();
  });
});
