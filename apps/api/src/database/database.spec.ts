import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Schema } from "mongoose";

describe("mongodb-memory-server", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it("persists and reads back a document through a real index", async () => {
    const PingModel = mongoose.model(
      "Ping",
      new Schema({ label: { type: String, unique: true } }),
    );

    await PingModel.create({ label: "phase-0" });
    const found = await PingModel.findOne({ label: "phase-0" });

    expect(found?.label).toBe("phase-0");
  });
});
