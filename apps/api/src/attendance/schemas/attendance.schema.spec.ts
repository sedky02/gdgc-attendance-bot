import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { Attendance, AttendanceSchema } from "./attendance.schema.js";

describe("Attendance indexes", () => {
  let mongod: MongoMemoryServer;
  let AttendanceModel: mongoose.Model<Attendance>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    AttendanceModel = mongoose.model(Attendance.name, AttendanceSchema);
    await AttendanceModel.ensureIndexes();
  });

  afterEach(async () => {
    await AttendanceModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it("rejects a second attendance document for the same user and meeting", async () => {
    const meeting = new Types.ObjectId();
    const base = {
      meeting,
      discordUserId: "user-1",
      usernameSnapshot: "aymen",
      displayNameSnapshot: "Aymen",
      expected: true,
    };

    await AttendanceModel.create(base);

    await expect(AttendanceModel.create(base)).rejects.toMatchObject({ code: 11000 });
  });

  it("allows the same user to have attendance documents across different meetings", async () => {
    const base = {
      discordUserId: "user-1",
      usernameSnapshot: "aymen",
      displayNameSnapshot: "Aymen",
      expected: true,
    };

    await AttendanceModel.create({ ...base, meeting: new Types.ObjectId() });

    await expect(AttendanceModel.create({ ...base, meeting: new Types.ObjectId() })).resolves.toBeDefined();
  });
});
