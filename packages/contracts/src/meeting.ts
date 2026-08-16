import { z } from "zod";
import { MeetingStatus } from "./enums.js";

export const MeetingPauseSchema = z.object({
  pausedAt: z.coerce.date(),
  resumedAt: z.coerce.date().nullable(),
});
export type MeetingPause = z.infer<typeof MeetingPauseSchema>;

export const ExpectedMemberSchema = z.object({
  discordUserId: z.string(),
  usernameSnapshot: z.string(),
  roleIds: z.array(z.string()),
});
export type ExpectedMember = z.infer<typeof ExpectedMemberSchema>;

export const MeetingStatsSchema = z.object({
  presentCount: z.number().int().nonnegative(),
  expectedCount: z.number().int().nonnegative(),
  unexpectedCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type MeetingStats = z.infer<typeof MeetingStatsSchema>;

export const MeetingSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  meetingType: z.string(),
  voiceChannelIds: z.array(z.string()).min(1),
  status: MeetingStatus,

  startedBy: z.string(),
  startedAt: z.coerce.date(),
  endedBy: z.string().nullable(),
  endedAt: z.coerce.date().nullable(),
  cancelReason: z.string().nullable(),

  pauses: z.array(MeetingPauseSchema),

  expectedMembers: z.array(ExpectedMemberSchema),

  summary: z.string().nullable(),
  summaryUpdatedBy: z.string().nullable(),
  summaryUpdatedAt: z.coerce.date().nullable(),

  stats: MeetingStatsSchema.nullable(),

  createdAt: z.coerce.date(),
});
export type Meeting = z.infer<typeof MeetingSchema>;

export const StartMeetingDto = z.object({
  guildId: z.string(),
  meetingTypeId: z.string(),
  voiceChannelIds: z.array(z.string()).min(1),
  startedBy: z.string(),
  expectedMembers: z.array(ExpectedMemberSchema),
  observedAt: z.coerce.date(),
});
export type StartMeetingDto = z.infer<typeof StartMeetingDto>;

export const EndMeetingDto = z.object({
  endedBy: z.string(),
  observedAt: z.coerce.date(),
});
export type EndMeetingDto = z.infer<typeof EndMeetingDto>;

export const CancelMeetingDto = z.object({
  cancelledBy: z.string(),
  cancelReason: z.string(),
  observedAt: z.coerce.date(),
});
export type CancelMeetingDto = z.infer<typeof CancelMeetingDto>;

export const PauseMeetingDto = z.object({
  pausedBy: z.string(),
  observedAt: z.coerce.date(),
});
export type PauseMeetingDto = z.infer<typeof PauseMeetingDto>;

export const ResumeMeetingDto = z.object({
  resumedBy: z.string(),
  observedAt: z.coerce.date(),
});
export type ResumeMeetingDto = z.infer<typeof ResumeMeetingDto>;

export const UpdateMeetingSummaryDto = z.object({
  summary: z.string().max(4000),
  summaryUpdatedBy: z.string(),
});
export type UpdateMeetingSummaryDto = z.infer<typeof UpdateMeetingSummaryDto>;

export const ListActiveMeetingsQueryDto = z.object({
  guildId: z.string(),
});
export type ListActiveMeetingsQueryDto = z.infer<typeof ListActiveMeetingsQueryDto>;

// Interim signal until Phase 4's reconciler gives the sweeper real per-user
// occupancy data. The bot polls each live meeting's voice channel(s) and
// reports whether anyone (non-bot) is present.
export const MeetingHeartbeatDto = z.object({
  isEmpty: z.boolean(),
  observedAt: z.coerce.date(),
});
export type MeetingHeartbeatDto = z.infer<typeof MeetingHeartbeatDto>;
