import { EmbedBuilder } from "discord.js";
import type { MeetingReport } from "@meeting-system/contracts";
import { formatDate, formatDuration, formatTime } from "../../utils/format-duration.js";

export function reportEmbed(meetingTypeName: string, report: MeetingReport): EmbedBuilder {
  const { meeting, attendance, absentees } = report;

  const start = formatTime(meeting.startedAt);
  const end = meeting.endedAt ? formatTime(meeting.endedAt) : "ongoing";
  const duration = meeting.stats ? ` (${formatDuration(meeting.stats.durationMs)})` : "";

  const presentCount = meeting.stats?.presentCount ?? attendance.length;
  const expectedCount = meeting.stats?.expectedCount ?? attendance.length + absentees.length;

  const attendeeLines = attendance
    .slice()
    .sort((a, b) => (a.stats?.firstJoinedAt.getTime() ?? 0) - (b.stats?.firstJoinedAt.getTime() ?? 0))
    .map((attendee) => {
      const joined = attendee.stats ? formatTime(attendee.stats.firstJoinedAt) : "?";
      const lastSession = attendee.sessions[attendee.sessions.length - 1];
      const left = lastSession?.leftAt ? formatTime(lastSession.leftAt) : "ongoing";
      const duration = attendee.stats ? `   ${formatDuration(attendee.stats.totalDurationMs)}` : "";
      const sessionsNote =
        attendee.stats && attendee.stats.sessionCount > 1 ? `   (${attendee.stats.sessionCount} sessions)` : "";
      const lateNote = attendee.stats && attendee.stats.latenessMs > 0 ? `   late ${formatDuration(attendee.stats.latenessMs)}` : "";
      const unexpectedNote = attendee.expected ? "" : "   (unexpected)";

      return `${attendee.displayNameSnapshot}   ${joined} → ${left}${duration}${sessionsNote}${lateNote}${unexpectedNote}`;
    });

  const absenteeLines = absentees.map((absentee) => `${absentee.usernameSnapshot}   absent`);

  return new EmbedBuilder()
    .setTitle(meetingTypeName)
    .setDescription(
      [
        `${formatDate(meeting.startedAt)} · ${start} → ${end}${duration}`,
        "",
        `Present  ${presentCount}/${expectedCount}`,
        "",
        ...attendeeLines,
        ...absenteeLines,
      ].join("\n"),
    )
    .setColor(0x5865f2);
}
