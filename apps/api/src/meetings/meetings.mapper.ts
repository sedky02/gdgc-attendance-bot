import type { Meeting as MeetingDto } from "@meeting-system/contracts";
import type { MeetingDocument } from "./schemas/meeting.schema.js";

export function toMeetingDto(doc: MeetingDocument): MeetingDto {
  return {
    id: doc._id.toString(),
    guildId: doc.guildId,
    meetingType: doc.meetingType.toString(),
    voiceChannelIds: doc.voiceChannelIds,
    status: doc.status,

    startedBy: doc.startedBy,
    startedAt: doc.startedAt,
    endedBy: doc.endedBy,
    endedAt: doc.endedAt,
    cancelReason: doc.cancelReason,

    pauses: doc.pauses.map((pause) => ({ pausedAt: pause.pausedAt, resumedAt: pause.resumedAt })),

    expectedMembers: doc.expectedMembers.map((member) => ({
      discordUserId: member.discordUserId,
      usernameSnapshot: member.usernameSnapshot,
      roleIds: member.roleIds,
    })),

    summary: doc.summary,
    summaryUpdatedBy: doc.summaryUpdatedBy,
    summaryUpdatedAt: doc.summaryUpdatedAt,

    stats: doc.stats
      ? {
          presentCount: doc.stats.presentCount,
          expectedCount: doc.stats.expectedCount,
          unexpectedCount: doc.stats.unexpectedCount,
          durationMs: doc.stats.durationMs,
        }
      : null,

    createdAt: doc.createdAt,
  };
}
