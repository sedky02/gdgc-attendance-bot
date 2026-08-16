import type { MeetingType as MeetingTypeDto } from "@meeting-system/contracts";
import type { MeetingTypeDocument } from "./schemas/meeting-type.schema.js";

export function toMeetingTypeDto(doc: MeetingTypeDocument): MeetingTypeDto {
  return {
    id: doc._id.toString(),
    guildId: doc.guildId,
    name: doc.name,
    roles: doc.roles.map((role) => ({ roleId: role.roleId, nameSnapshot: role.nameSnapshot })),
    createdBy: doc.createdBy,
    archived: doc.archived,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
