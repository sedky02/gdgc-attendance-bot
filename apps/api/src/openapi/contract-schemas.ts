import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  AcknowledgedResponseDto,
  AttendanceSchema,
  AttendanceStatsSchema,
  CancelMeetingDto,
  CreateMeetingTypeDto,
  EndMeetingDto,
  ExpectedMemberSchema,
  HealthResponseDto,
  ListActiveMeetingsQueryDto,
  ListMeetingTypesQueryDto,
  ListMeetingsQueryDto,
  ManualAttendanceDto,
  MeetingPauseSchema,
  MeetingReportSchema,
  MeetingSchema,
  MeetingStatsSchema,
  MeetingStatus,
  MeetingTypeRoleSchema,
  MeetingTypeSchema,
  MeetingsPageSchema,
  PauseMeetingDto,
  PingResponseDto,
  PresentMemberSchema,
  ResumeMeetingDto,
  SessionSchema,
  SessionSource,
  StartMeetingDto,
  SyncAttendanceDto,
  UpdateAttendanceDto,
  UpdateMeetingSummaryDto,
  UpdateMeetingTypeDto,
  VoiceEventDto,
} from "@meeting-system/contracts";

/**
 * Every payload shape the HTTP surface speaks, keyed by the name it takes in
 * `components.schemas`. Keys mirror the export names in packages/contracts
 * (minus a trailing `Schema`) so a reader can grep one and find the other.
 *
 * This registry is the only place OpenAPI learns about a payload. The Zod
 * schema stays the single source of truth (CLAUDE.md rule #2) — nothing here
 * re-declares a shape, and there is no parallel class DTO to drift from it.
 */
export const CONTRACT_SCHEMAS = {
  // Enums. Registered in their own right because they appear in more than one
  // schema — without an entry here the second use $refs into wherever the
  // first one happened to land (`Meeting/properties/status`), which is
  // technically resolvable and completely unreadable.
  MeetingStatus,
  SessionSource,

  // Meeting types
  MeetingType: MeetingTypeSchema,
  MeetingTypeRole: MeetingTypeRoleSchema,
  CreateMeetingTypeDto,
  UpdateMeetingTypeDto,
  ListMeetingTypesQueryDto,

  // Meetings
  Meeting: MeetingSchema,
  MeetingPause: MeetingPauseSchema,
  MeetingStats: MeetingStatsSchema,
  ExpectedMember: ExpectedMemberSchema,
  MeetingsPage: MeetingsPageSchema,
  StartMeetingDto,
  PauseMeetingDto,
  ResumeMeetingDto,
  EndMeetingDto,
  CancelMeetingDto,
  UpdateMeetingSummaryDto,
  ListMeetingsQueryDto,
  ListActiveMeetingsQueryDto,

  // Attendance
  Attendance: AttendanceSchema,
  AttendanceStats: AttendanceStatsSchema,
  Session: SessionSchema,
  PresentMember: PresentMemberSchema,
  SyncAttendanceDto,
  ManualAttendanceDto,
  UpdateAttendanceDto,

  // Reports
  MeetingReport: MeetingReportSchema,

  // Internal + health
  VoiceEventDto,
  HealthResponseDto,
  PingResponseDto,
  AcknowledgedResponseDto,
} satisfies Record<string, z.ZodTypeAny>;

export type ContractSchemaName = keyof typeof CONTRACT_SCHEMAS;

const DEFINITION_PATH = "schemas";

export function contractSchemaRef(name: ContractSchemaName): string {
  return `#/components/${DEFINITION_PATH}/${name}`;
}

/**
 * Converts the whole registry in one pass so that schemas which embed each
 * other (a MeetingReport holds Meetings and Attendances) come out as `$ref`s
 * into `components.schemas` rather than inlined copies. Converting them one
 * at a time would duplicate Meeting into six different places.
 */
export function buildContractSchemas(): Record<string, unknown> {
  const converted = zodToJsonSchema(z.object({}), {
    target: "openApi3",
    $refStrategy: "root",
    basePath: ["#", "components"],
    definitionPath: DEFINITION_PATH,
    definitions: CONTRACT_SCHEMAS,
  }) as { schemas?: Record<string, unknown> };

  return converted.schemas ?? {};
}

/**
 * A single schema, fully inlined. Used for query strings, where each property
 * becomes its own `?name=` parameter and a `$ref` to the enclosing object
 * would say nothing useful.
 */
export function inlineContractSchema(name: ContractSchemaName): {
  properties?: Record<string, unknown>;
  required?: string[];
} {
  return zodToJsonSchema(CONTRACT_SCHEMAS[name], {
    target: "openApi3",
    $refStrategy: "none",
  }) as { properties?: Record<string, unknown>; required?: string[] };
}
