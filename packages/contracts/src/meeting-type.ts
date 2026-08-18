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
  roles: z.array(MeetingTypeRoleSchema).min(1),
  createdBy: z.string(),
  archived: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type MeetingType = z.infer<typeof MeetingTypeSchema>;

export const CreateMeetingTypeDto = z.object({
  guildId: z.string(),
  name: z.string().min(1).max(100),
  roles: z.array(MeetingTypeRoleSchema).min(1),
  createdBy: z.string(),
});
export type CreateMeetingTypeDto = z.infer<typeof CreateMeetingTypeDto>;

export const UpdateMeetingTypeDto = z.object({
  name: z.string().min(1).max(100).optional(),
  roles: z.array(MeetingTypeRoleSchema).min(1).optional(),
});
export type UpdateMeetingTypeDto = z.infer<typeof UpdateMeetingTypeDto>;

// `z.coerce.boolean()` runs plain `Boolean(value)`, so a literal "false" query
// string coerces to `true` — any non-empty string is truthy. Parse the two
// accepted literals explicitly instead.
const queryBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const ListMeetingTypesQueryDto = z.object({
  guildId: z.string(),
  archived: queryBoolean.optional(),
});
export type ListMeetingTypesQueryDto = z.infer<typeof ListMeetingTypesQueryDto>;
