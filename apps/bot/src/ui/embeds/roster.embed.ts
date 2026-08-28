import { EmbedBuilder } from "discord.js";
import type { Meeting, MeetingReport } from "@meeting-system/contracts";
import { formatDuration, formatTime } from "../../utils/format-duration.js";

const PRESENT_DOT = "🟢";
const LATE_DOT = "🟡";
const ABSENT_DOT = "🔴";

const STATUS_LABEL: Record<Meeting["status"], string> = {
  ACTIVE: "Live",
  PAUSED: "Paused",
  COMPLETED: "Ended",
  CANCELLED: "Cancelled",
};

const STATUS_COLOR: Record<Meeting["status"], number> = {
  ACTIVE: 0x57f287, // green
  PAUSED: 0x94a3b8, // slate
  COMPLETED: 0x5865f2, // blurple
  CANCELLED: 0xed4245, // red
};

/**
 * The public, repeatedly-edited roster for a live meeting — present members
 * (green, or yellow if they arrived after the meeting started), and expected
 * members who haven't shown up yet (red). Shared by /start-meeting's
 * live-updating message and /meeting-status's on-demand snapshot, both of
 * which already have a `MeetingReport` (attendance + absentees) from the
 * same `GET /meetings/:id/report` the /end-meeting summary uses.
 */
export function rosterEmbed(meetingTypeName: string, report: MeetingReport): EmbedBuilder {
  const { meeting, attendance, absentees } = report;

  const presentLines = attendance
    .slice()
    .sort((a, b) => (a.stats?.firstJoinedAt.getTime() ?? 0) - (b.stats?.firstJoinedAt.getTime() ?? 0))
    .map((attendee) => {
      const isLate = (attendee.stats?.latenessMs ?? 0) > 0;
      const dot = isLate ? LATE_DOT : PRESENT_DOT;
      const joined = attendee.stats ? formatTime(attendee.stats.firstJoinedAt) : "?";
      const lateNote = isLate ? `   late ${formatDuration(attendee.stats!.latenessMs)}` : "";
      const unexpectedNote = attendee.expected ? "" : "   (unexpected)";

      return `${dot} ${attendee.displayNameSnapshot}   joined ${joined}${lateNote}${unexpectedNote}`;
    });

  const absentLines = absentees.map((absentee) => `${ABSENT_DOT} ${absentee.usernameSnapshot}   absent`);

  const presentCount = meeting.stats?.presentCount ?? attendance.length;
  const expectedCount = meeting.stats?.expectedCount ?? attendance.length + absentees.length;

  return new EmbedBuilder()
    .setTitle(meetingTypeName)
    .setDescription(
      [
        `${STATUS_LABEL[meeting.status]} · Present ${presentCount}/${expectedCount}`,
        "",
        presentLines.length > 0 ? presentLines.join("\n") : "_Nobody has joined yet._",
        absentLines.length > 0 ? `\n${absentLines.join("\n")}` : "",
      ].join("\n"),
    )
    .setColor(STATUS_COLOR[meeting.status])
    .setTimestamp(new Date());
}
