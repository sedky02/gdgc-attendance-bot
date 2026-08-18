import {
  AttendanceSchema,
  CancelMeetingDto,
  EndMeetingDto,
  MeetingReportSchema,
  MeetingSchema,
  PauseMeetingDto,
  ResumeMeetingDto,
  StartMeetingDto,
  SyncAttendanceDto,
  type Attendance,
  type Meeting,
  type MeetingReport,
} from "@meeting-system/contracts";
import { z } from "zod";
import { httpClient } from "./http-client.js";

export const meetingsApi = {
  listActive: async (guildId: string): Promise<Meeting[]> =>
    z.array(MeetingSchema).parse(await httpClient.get<unknown>(`/meetings/active?guildId=${encodeURIComponent(guildId)}`)),

  start: async (dto: StartMeetingDto): Promise<Meeting> =>
    MeetingSchema.parse(await httpClient.post<unknown>("/meetings", dto)),

  pause: async (id: string, dto: PauseMeetingDto): Promise<Meeting> =>
    MeetingSchema.parse(await httpClient.post<unknown>(`/meetings/${id}/pause`, dto)),

  resume: async (id: string, dto: ResumeMeetingDto): Promise<Meeting> =>
    MeetingSchema.parse(await httpClient.post<unknown>(`/meetings/${id}/resume`, dto)),

  end: async (id: string, dto: EndMeetingDto): Promise<Meeting> =>
    MeetingSchema.parse(await httpClient.post<unknown>(`/meetings/${id}/end`, dto)),

  cancel: async (id: string, dto: CancelMeetingDto): Promise<Meeting> =>
    MeetingSchema.parse(await httpClient.post<unknown>(`/meetings/${id}/cancel`, dto)),

  syncAttendance: async (id: string, dto: SyncAttendanceDto): Promise<void> => {
    await httpClient.post<unknown>(`/meetings/${id}/attendance/sync`, dto, { retries: 0 });
  },

  getAttendance: async (id: string): Promise<Attendance[]> =>
    z.array(AttendanceSchema).parse(await httpClient.get<unknown>(`/meetings/${id}/attendance`)),

  getReport: async (id: string): Promise<MeetingReport> =>
    MeetingReportSchema.parse(await httpClient.get<unknown>(`/meetings/${id}/report`)),
};
