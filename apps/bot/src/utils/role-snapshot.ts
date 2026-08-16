import type { MeetingTypeRole } from "@meeting-system/contracts";

export function rolesToSnapshot(roles: Iterable<{ id: string; name: string }>): MeetingTypeRole[] {
  return [...roles].map((role) => ({ roleId: role.id, nameSnapshot: role.name }));
}
