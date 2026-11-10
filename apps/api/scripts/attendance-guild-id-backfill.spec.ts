import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types, type Model } from "mongoose";
import { Meeting, MeetingSchema } from "../src/meetings/schemas/meeting.schema.js";
import { Attendance, AttendanceSchema } from "../src/attendance/schemas/attendance.schema.js";
import { backfillAttendanceGuildId } from "./attendance-guild-id-backfill.js";

describe("backfillAttendanceGuildId", () => {
  let mongod: MongoMemoryServer;
  let connection: mongoose.Connection;
  let meetingModel: Model<Meeting>;
  let attendanceModel: Model<Attendance>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();
    meetingModel = connection.model(Meeting.name, MeetingSchema);
    attendanceModel = connection.model(Attendance.name, AttendanceSchema);
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  const legacyAttendance = (meeting: Types.ObjectId, discordUserId: string) => ({
    meeting,
    discordUserId,
    usernameSnapshot: discordUserId,
    displayNameSnapshot: discordUserId,
    expected: true,
    sessions: [],
  });

  it("copies the parent meeting's guildId, leaves existing values alone, and is idempotent", async () => {
    const [meetingA, meetingB] = [new Types.ObjectId(), new Types.ObjectId()];
    await meetingModel.collection.insertMany([
      { _id: meetingA, guildId: "guild-a" },
      { _id: meetingB, guildId: "guild-b" },
    ]);
    await attendanceModel.collection.insertMany([
      legacyAttendance(meetingA, "user-1"),
      legacyAttendance(meetingA, "user-2"),
      legacyAttendance(meetingB, "user-1"),
      { ...legacyAttendance(meetingB, "user-3"), guildId: "already-set" },
      legacyAttendance(new Types.ObjectId(), "orphan"),
    ]);

    const firstRun = await backfillAttendanceGuildId(meetingModel, attendanceModel);
    const secondRun = await backfillAttendanceGuildId(meetingModel, attendanceModel);

    expect(firstRun).toEqual({ updated: 3, orphaned: 1 });
    expect(secondRun).toEqual({ updated: 0, orphaned: 1 });

    const byUser = async (meeting: Types.ObjectId, discordUserId: string) =>
      (await attendanceModel.findOne({ meeting, discordUserId }))?.guildId;
    expect(await byUser(meetingA, "user-1")).toBe("guild-a");
    expect(await byUser(meetingA, "user-2")).toBe("guild-a");
    expect(await byUser(meetingB, "user-1")).toBe("guild-b");
    expect(await byUser(meetingB, "user-3")).toBe("already-set");
  });
});
