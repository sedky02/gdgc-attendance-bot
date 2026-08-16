import { z } from "zod";
import { ResolvePresenceScope, SessionSource } from "./enums.js";

export const SessionSchema = z.object({
  joinedAt: z.coerce.date(),
  leftAt: z.coerce.date().nullable(),
  source: SessionSource,
});
export type Session = z.infer<typeof SessionSchema>;

export const AttendanceStatsSchema = z.object({
  firstJoinedAt: z.coerce.date(),
  latenessMs: z.number().int().nonnegative(),
  totalDurationMs: z.number().int().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
});
export type AttendanceStats = z.infer<typeof AttendanceStatsSchema>;

export const AttendanceSchema = z.object({
  id: z.string(),
  meeting: z.string(),
  discordUserId: z.string(),
  usernameSnapshot: z.string(),
  displayNameSnapshot: z.string(),
  expected: z.boolean(),

  sessions: z.array(SessionSchema),

  manuallyEdited: z.boolean(),
  editedBy: z.string().nullable(),

  stats: AttendanceStatsSchema.nullable(),
});
export type Attendance = z.infer<typeof AttendanceSchema>;

export const ResolvePresenceDto = z.object({
  presentUserIds: z.array(z.string()),
  observedAt: z.coerce.date(),
  scope: ResolvePresenceScope,
  source: SessionSource,
});
export type ResolvePresenceDto = z.infer<typeof ResolvePresenceDto>;

export const SyncAttendanceDto = z.object({
  presentUserIds: z.array(z.string()),
  observedAt: z.coerce.date(),
});
export type SyncAttendanceDto = z.infer<typeof SyncAttendanceDto>;

export const ManualAttendanceDto = z.object({
  discordUserId: z.string(),
  usernameSnapshot: z.string(),
  displayNameSnapshot: z.string(),
  sessions: z.array(SessionSchema),
  editedBy: z.string(),
});
export type ManualAttendanceDto = z.infer<typeof ManualAttendanceDto>;

export const UpdateAttendanceDto = z.object({
  sessions: z.array(SessionSchema),
  editedBy: z.string(),
});
export type UpdateAttendanceDto = z.infer<typeof UpdateAttendanceDto>;

export const VoiceEventDto = z.object({
  guildId: z.string(),
  userId: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  occurredAt: z.coerce.date(),
});
export type VoiceEventDto = z.infer<typeof VoiceEventDto>;
