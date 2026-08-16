import { z } from "zod";
import { MeetingSchema, ExpectedMemberSchema } from "./meeting.js";
import { AttendanceSchema } from "./attendance.js";

export const MeetingReportSchema = z.object({
  meeting: MeetingSchema,
  attendance: z.array(AttendanceSchema),
  absentees: z.array(ExpectedMemberSchema),
});
export type MeetingReport = z.infer<typeof MeetingReportSchema>;
