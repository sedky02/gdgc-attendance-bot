import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import { NotFoundException } from "@nestjs/common";
import { MeetingTypesService } from "./meeting-types.service.js";
import { MeetingType, MeetingTypeSchema } from "./schemas/meeting-type.schema.js";

describe("MeetingTypesService", () => {
  let mongod: MongoMemoryServer;
  let service: MeetingTypesService;
  let model: Model<MeetingType>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([{ name: MeetingType.name, schema: MeetingTypeSchema }]),
      ],
      providers: [MeetingTypesService],
    }).compile();

    service = moduleRef.get(MeetingTypesService);
    model = moduleRef.get(getModelToken(MeetingType.name));
  });

  afterEach(async () => {
    await model.deleteMany({});
  });

  afterAll(async () => {
    await model.db.close();
    await mongod.stop();
  });

  const guildId = "guild-1";

  it("creates a meeting type and lists it back for its guild", async () => {
    const created = await service.create({
      guildId,
      name: "Weekly Technical Meeting",
      roles: [{ roleId: "role-1", nameSnapshot: "Member" }],
      createdBy: "user-1",
    });

    expect(created.archived).toBe(false);

    const listed = await service.list({ guildId });
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("Weekly Technical Meeting");
  });

  it("refreshes nameSnapshot when roles are re-selected on edit", async () => {
    const created = await service.create({
      guildId,
      name: "Weekly Technical Meeting",
      roles: [{ roleId: "role-1", nameSnapshot: "Member" }],
      createdBy: "user-1",
    });

    // Discord role renamed since creation; the bot resends the live name on every edit.
    const updated = await service.update(created.id, {
      roles: [{ roleId: "role-1", nameSnapshot: "Active Member" }],
    });

    expect(updated.roles).toEqual([{ roleId: "role-1", nameSnapshot: "Active Member" }]);
  });

  it("soft-deletes by setting archived, without removing the document", async () => {
    const created = await service.create({
      guildId,
      name: "Officers Sync",
      roles: [],
      createdBy: "user-1",
    });

    const archived = await service.archive(created.id);
    expect(archived.archived).toBe(true);

    const stillListed = await service.list({ guildId, archived: true });
    expect(stillListed.map((m) => m.id)).toContain(created.id);
  });

  it("excludes archived types from the default (non-archived) listing", async () => {
    const created = await service.create({
      guildId,
      name: "Officers Sync",
      roles: [],
      createdBy: "user-1",
    });
    await service.archive(created.id);

    const activeOnly = await service.list({ guildId, archived: false });
    expect(activeOnly.map((m) => m.id)).not.toContain(created.id);
  });

  it("throws NotFoundException for an unknown id", async () => {
    const fakeId = new Types.ObjectId().toString();
    await expect(service.get(fakeId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
