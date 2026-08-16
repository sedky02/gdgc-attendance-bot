import { z } from "zod";

export const MeetingTypeRoleSchema = z.object({
  roleId: z.string(),
  nameSnapshot: z.string(),
});
export type MeetingTypeRole = z.infer<typeof MeetingTypeRoleSchema>;

export const MeetingTypeSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  name: z.string().min(1).max(100),
  roles: z.array(MeetingTypeRoleSchema),
  createdBy: z.string(),
  archived: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type MeetingType = z.infer<typeof MeetingTypeSchema>;

export const CreateMeetingTypeDto = z.object({
  guildId: z.string(),
  name: z.string().min(1).max(100),
  roleIds: z.array(z.string()),
  createdBy: z.string(),
});
export type CreateMeetingTypeDto = z.infer<typeof CreateMeetingTypeDto>;

export const UpdateMeetingTypeDto = z.object({
  name: z.string().min(1).max(100).optional(),
  roleIds: z.array(z.string()).optional(),
});
export type UpdateMeetingTypeDto = z.infer<typeof UpdateMeetingTypeDto>;
