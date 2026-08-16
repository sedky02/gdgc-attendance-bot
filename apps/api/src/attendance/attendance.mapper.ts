import type { Attendance as AttendanceDto } from "@meeting-system/contracts";
import type { AttendanceDocument } from "./schemas/attendance.schema.js";

export function toAttendanceDto(doc: AttendanceDocument): AttendanceDto {
  return {
    id: doc._id.toString(),
    meeting: doc.meeting.toString(),
    discordUserId: doc.discordUserId,
    usernameSnapshot: doc.usernameSnapshot,
    displayNameSnapshot: doc.displayNameSnapshot,
    expected: doc.expected,

    sessions: doc.sessions.map((session) => ({
      joinedAt: session.joinedAt,
      leftAt: session.leftAt,
      source: session.source,
    })),

    manuallyEdited: doc.manuallyEdited,
    editedBy: doc.editedBy,

    stats: doc.stats
      ? {
          firstJoinedAt: doc.stats.firstJoinedAt,
          latenessMs: doc.stats.latenessMs,
          totalDurationMs: doc.stats.totalDurationMs,
          sessionCount: doc.stats.sessionCount,
        }
      : null,
  };
}
