import type { Model } from "mongoose";
import type { Meeting } from "../src/meetings/schemas/meeting.schema.js";
import type { Attendance } from "../src/attendance/schemas/attendance.schema.js";

export interface BackfillResult {
  updated: number;
  orphaned: number;
}

/**
 * Copies each meeting's guildId onto its attendance records that predate the
 * field. Idempotent: only records still missing guildId are touched, so it is
 * safe to re-run and safe to run while the API is serving traffic.
 */
export async function backfillAttendanceGuildId(
  meetingModel: Model<Meeting>,
  attendanceModel: Model<Attendance>,
): Promise<BackfillResult> {
  const missingGuildId = { guildId: { $exists: false } };
  const meetingIds = await attendanceModel.distinct("meeting", missingGuildId);
  const meetings = await meetingModel.find({ _id: { $in: meetingIds } }, "guildId");

  let updated = 0;
  for (const meeting of meetings) {
    const result = await attendanceModel.updateMany(
      { meeting: meeting._id, ...missingGuildId },
      { $set: { guildId: meeting.guildId } },
    );
    updated += result.modifiedCount;
  }

  const orphaned = await attendanceModel.countDocuments(missingGuildId);
  return { updated, orphaned };
}
