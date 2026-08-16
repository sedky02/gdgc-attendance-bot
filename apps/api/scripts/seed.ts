import "dotenv/config";
import mongoose from "mongoose";
import { MeetingType, MeetingTypeSchema } from "../src/meeting-types/schemas/meeting-type.schema.js";
import { Meeting, MeetingSchema } from "../src/meetings/schemas/meeting.schema.js";
import { Attendance, AttendanceSchema } from "../src/attendance/schemas/attendance.schema.js";

const SEED_GUILD_ID = "111111111111111111";
const CREATED_BY = "444444444444444444";

const TECHNICAL_ROLE_ID = "222222222222222222";
const OFFICER_ROLE_ID = "333333333333333333";

const aymen = { discordUserId: "555555555555555555", usernameSnapshot: "aymen", displayNameSnapshot: "Aymen" };
const sami = { discordUserId: "666666666666666666", usernameSnapshot: "sami", displayNameSnapshot: "Sami" };
const ali = { discordUserId: "777777777777777777", usernameSnapshot: "ali", displayNameSnapshot: "Ali" };
const ahmed = { discordUserId: "888888888888888888", usernameSnapshot: "ahmed", displayNameSnapshot: "Ahmed" };

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required to run the seed script");
  }

  await mongoose.connect(uri);

  const MeetingTypeModel = mongoose.model(MeetingType.name, MeetingTypeSchema);
  const MeetingModel = mongoose.model(Meeting.name, MeetingSchema);
  const AttendanceModel = mongoose.model(Attendance.name, AttendanceSchema);

  // Idempotent: wipe this guild's seed data before writing it again so the
  // script can run repeatedly without accumulating duplicates.
  const existingMeetings = await MeetingModel.find({ guildId: SEED_GUILD_ID }, "_id");
  await AttendanceModel.deleteMany({ meeting: { $in: existingMeetings.map((m) => m._id) } });
  await MeetingModel.deleteMany({ guildId: SEED_GUILD_ID });
  await MeetingTypeModel.deleteMany({ guildId: SEED_GUILD_ID });

  const [technical, officers] = await MeetingTypeModel.create([
    {
      guildId: SEED_GUILD_ID,
      name: "Weekly Technical Meeting",
      roles: [{ roleId: TECHNICAL_ROLE_ID, nameSnapshot: "Member" }],
      createdBy: CREATED_BY,
      archived: false,
    },
    {
      guildId: SEED_GUILD_ID,
      name: "Officers Sync",
      roles: [{ roleId: OFFICER_ROLE_ID, nameSnapshot: "Officer" }],
      createdBy: CREATED_BY,
      archived: false,
    },
  ]);

  const meeting1 = await MeetingModel.create({
    guildId: SEED_GUILD_ID,
    meetingType: technical._id,
    voiceChannelIds: ["101010101010101010"],
    status: "COMPLETED",
    startedBy: CREATED_BY,
    startedAt: new Date("2026-07-06T19:00:00Z"),
    endedBy: CREATED_BY,
    endedAt: new Date("2026-07-06T20:35:00Z"),
    cancelReason: null,
    pauses: [],
    expectedMembers: [aymen, sami, ali, ahmed].map((m) => ({ ...m, roleIds: [TECHNICAL_ROLE_ID] })),
    summary: "Covered the new attendance bot architecture.",
    summaryUpdatedBy: CREATED_BY,
    summaryUpdatedAt: new Date("2026-07-06T20:40:00Z"),
    stats: { presentCount: 3, expectedCount: 4, unexpectedCount: 0, durationMs: 5_700_000 },
  });

  const meeting2 = await MeetingModel.create({
    guildId: SEED_GUILD_ID,
    meetingType: officers._id,
    voiceChannelIds: ["202020202020202020"],
    status: "COMPLETED",
    startedBy: CREATED_BY,
    startedAt: new Date("2026-07-13T18:00:00Z"),
    endedBy: CREATED_BY,
    endedAt: new Date("2026-07-13T18:47:00Z"),
    cancelReason: null,
    pauses: [],
    expectedMembers: [sami, ali].map((m) => ({ ...m, roleIds: [OFFICER_ROLE_ID] })),
    summary: null,
    summaryUpdatedBy: null,
    summaryUpdatedAt: null,
    stats: { presentCount: 3, expectedCount: 2, unexpectedCount: 1, durationMs: 2_820_000 },
  });

  const meeting3 = await MeetingModel.create({
    guildId: SEED_GUILD_ID,
    meetingType: technical._id,
    voiceChannelIds: ["101010101010101010"],
    status: "COMPLETED",
    startedBy: CREATED_BY,
    startedAt: new Date("2026-08-03T19:00:00Z"),
    endedBy: "SYSTEM",
    endedAt: new Date("2026-08-03T20:12:00Z"),
    cancelReason: null,
    pauses: [],
    expectedMembers: [aymen, sami, ali, ahmed].map((m) => ({ ...m, roleIds: [TECHNICAL_ROLE_ID] })),
    summary: null,
    summaryUpdatedBy: null,
    summaryUpdatedAt: null,
    stats: { presentCount: 2, expectedCount: 4, unexpectedCount: 0, durationMs: 4_320_000 },
  });

  await AttendanceModel.create([
    // Meeting 1 — Weekly Technical Meeting, 3 of 4 expected members present.
    {
      meeting: meeting1._id,
      ...aymen,
      expected: true,
      sessions: [
        { joinedAt: new Date("2026-07-06T19:02:00Z"), leftAt: new Date("2026-07-06T20:00:00Z"), source: "EVENT" },
        { joinedAt: new Date("2026-07-06T20:05:00Z"), leftAt: new Date("2026-07-06T20:35:00Z"), source: "EVENT" },
      ],
      manuallyEdited: false,
      editedBy: null,
      stats: {
        firstJoinedAt: new Date("2026-07-06T19:02:00Z"),
        latenessMs: 120_000,
        totalDurationMs: 5_280_000,
        sessionCount: 2,
      },
    },
    {
      meeting: meeting1._id,
      ...sami,
      expected: true,
      sessions: [{ joinedAt: new Date("2026-07-06T19:00:00Z"), leftAt: new Date("2026-07-06T20:10:00Z"), source: "EVENT" }],
      manuallyEdited: false,
      editedBy: null,
      stats: {
        firstJoinedAt: new Date("2026-07-06T19:00:00Z"),
        latenessMs: 0,
        totalDurationMs: 4_200_000,
        sessionCount: 1,
      },
    },
    {
      meeting: meeting1._id,
      ...ali,
      expected: true,
      sessions: [{ joinedAt: new Date("2026-07-06T19:17:00Z"), leftAt: new Date("2026-07-06T20:35:00Z"), source: "SYNC" }],
      manuallyEdited: false,
      editedBy: null,
      stats: {
        firstJoinedAt: new Date("2026-07-06T19:17:00Z"),
        latenessMs: 1_020_000,
        totalDurationMs: 4_680_000,
        sessionCount: 1,
      },
    },

    // Meeting 2 — Officers Sync. Aymen shows up without the Officer role.
    {
      meeting: meeting2._id,
      ...sami,
      expected: true,
      sessions: [{ joinedAt: new Date("2026-07-13T18:00:00Z"), leftAt: new Date("2026-07-13T18:47:00Z"), source: "EVENT" }],
      manuallyEdited: false,
      editedBy: null,
      stats: {
        firstJoinedAt: new Date("2026-07-13T18:00:00Z"),
        latenessMs: 0,
        totalDurationMs: 2_820_000,
        sessionCount: 1,
      },
    },
    {
      meeting: meeting2._id,
      ...ali,
      expected: true,
      sessions: [{ joinedAt: new Date("2026-07-13T18:05:00Z"), leftAt: new Date("2026-07-13T18:47:00Z"), source: "EVENT" }],
      manuallyEdited: false,
      editedBy: null,
      stats: {
        firstJoinedAt: new Date("2026-07-13T18:05:00Z"),
        latenessMs: 300_000,
        totalDurationMs: 2_520_000,
        sessionCount: 1,
      },
    },
    {
      meeting: meeting2._id,
      ...aymen,
      expected: false,
      sessions: [{ joinedAt: new Date("2026-07-13T18:10:00Z"), leftAt: new Date("2026-07-13T18:20:00Z"), source: "EVENT" }],
      manuallyEdited: false,
      editedBy: null,
      stats: {
        firstJoinedAt: new Date("2026-07-13T18:10:00Z"),
        latenessMs: 600_000,
        totalDurationMs: 600_000,
        sessionCount: 1,
      },
    },

    // Meeting 3 — Weekly Technical Meeting, swept closed by the sweeper. Sami and Ali absent.
    {
      meeting: meeting3._id,
      ...aymen,
      expected: true,
      sessions: [{ joinedAt: new Date("2026-08-03T19:00:00Z"), leftAt: new Date("2026-08-03T20:12:00Z"), source: "EVENT" }],
      manuallyEdited: false,
      editedBy: null,
      stats: {
        firstJoinedAt: new Date("2026-08-03T19:00:00Z"),
        latenessMs: 0,
        totalDurationMs: 4_320_000,
        sessionCount: 1,
      },
    },
    {
      meeting: meeting3._id,
      ...ahmed,
      expected: true,
      sessions: [{ joinedAt: new Date("2026-08-03T19:30:00Z"), leftAt: new Date("2026-08-03T20:12:00Z"), source: "SYNC" }],
      manuallyEdited: false,
      editedBy: null,
      stats: {
        firstJoinedAt: new Date("2026-08-03T19:30:00Z"),
        latenessMs: 1_800_000,
        totalDurationMs: 2_520_000,
        sessionCount: 1,
      },
    },
  ]);

  console.log(
    `Seeded guild ${SEED_GUILD_ID}: 2 meeting types, 3 completed meetings, 8 attendance records.`,
  );

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
