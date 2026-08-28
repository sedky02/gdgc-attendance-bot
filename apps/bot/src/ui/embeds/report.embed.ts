import { EmbedBuilder } from "discord.js";
import type { MeetingReport } from "@meeting-system/contracts";
import { discordTimestamp, formatDuration } from "../../utils/format-duration.js";

const PRESENT_DOT = "🟢";
const LATE_DOT = "🟡";
const ABSENT_DOT = "🔴";

/**
 * The final report posted by /end-meeting. Present/absent split into
 * separate embed fields — rather than one long description block — and the
 * same 🟢/🟡/🔴 dot convention as the live roster embed, so a viewer who saw
 * the meeting live recognizes the same at-a-glance status here.
 */
export function reportEmbed(meetingTypeName: string, report: MeetingReport): EmbedBuilder {
  const { meeting, attendance, absentees } = report;

  const start = discordTimestamp(meeting.startedAt, "t");
  const end = meeting.endedAt ? discordTimestamp(meeting.endedAt, "t") : "ongoing";
  const duration = meeting.stats ? ` · ${formatDuration(meeting.stats.durationMs)}` : "";

  const presentCount = meeting.stats?.presentCount ?? attendance.length;
  const expectedCount = meeting.stats?.expectedCount ?? attendance.length + absentees.length;

  const attendeeLines = attendance
    .slice()
    .sort((a, b) => (a.stats?.firstJoinedAt.getTime() ?? 0) - (b.stats?.firstJoinedAt.getTime() ?? 0))
    .map((attendee) => {
      const isLate = (attendee.stats?.latenessMs ?? 0) > 0;
      const dot = isLate ? LATE_DOT : PRESENT_DOT;
      const joined = attendee.stats ? discordTimestamp(attendee.stats.firstJoinedAt, "t") : "?";
      const lastSession = attendee.sessions[attendee.sessions.length - 1];
      const left = lastSession?.leftAt ? discordTimestamp(lastSession.leftAt, "t") : "ongoing";
      const durationNote = attendee.stats ? `   ${formatDuration(attendee.stats.totalDurationMs)}` : "";
      const sessionsNote =
        attendee.stats && attendee.stats.sessionCount > 1 ? `   (${attendee.stats.sessionCount} sessions)` : "";
      const lateNote = isLate ? `   late ${formatDuration(attendee.stats!.latenessMs)}` : "";
      const unexpectedNote = attendee.expected ? "" : "   (unexpected)";

      return `${dot} **${attendee.displayNameSnapshot}**   ${joined} → ${left}${durationNote}${sessionsNote}${lateNote}${unexpectedNote}`;
    });

  const absenteeLines = absentees.map((absentee) => `${ABSENT_DOT} ${absentee.usernameSnapshot}`);

  const embed = new EmbedBuilder()
    .setTitle(`📋 ${meetingTypeName}`)
    .setDescription(
      [`${discordTimestamp(meeting.startedAt, "D")} · ${start} → ${end}${duration}`, `**Present ${presentCount}/${expectedCount}**`].join(
        "\n",
      ),
    )
    .addFields({
      name: `Present (${attendance.length})`,
      value: attendeeLines.length > 0 ? attendeeLines.join("\n") : "_Nobody attended._",
    })
    .setColor(0x5865f2)
    .setTimestamp(meeting.endedAt ?? new Date());

  if (absenteeLines.length > 0) {
    embed.addFields({ name: `Absent (${absenteeLines.length})`, value: absenteeLines.join("\n") });
  }

  return embed;
}
