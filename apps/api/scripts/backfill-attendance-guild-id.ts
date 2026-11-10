import "dotenv/config";
import mongoose from "mongoose";
import { Meeting, MeetingSchema } from "../src/meetings/schemas/meeting.schema.js";
import { Attendance, AttendanceSchema } from "../src/attendance/schemas/attendance.schema.js";
import { backfillAttendanceGuildId } from "./attendance-guild-id-backfill.js";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required to run the backfill");
  }

  await mongoose.connect(uri);
  const result = await backfillAttendanceGuildId(
    mongoose.model(Meeting.name, MeetingSchema),
    mongoose.model(Attendance.name, AttendanceSchema),
  );
  console.log(
    `Backfilled guildId on ${result.updated} attendance records; ${result.orphaned} left without one (their meeting no longer exists).`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
