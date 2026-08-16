import { z } from "zod";
import {
  MeetingReportSchema,
  MeetingSchema,
  MeetingsPageSchema,
  MeetingTypeSchema,
  type ManualAttendanceDto,
  type Meeting,
  type MeetingReport,
  type MeetingsPage,
  type MeetingType,
  type MeetingStatus,
  type UpdateAttendanceDto,
  type UpdateMeetingSummaryDto,
  type UpdateMeetingTypeDto,
} from "@meeting-system/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ message: response.statusText }))) as { message?: string };
    throw new ApiError(payload.message ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

export const api = {
  meetingTypes: {
    list: async (token: string, guildId: string, archived?: boolean): Promise<MeetingType[]> => {
      const params = new URLSearchParams({ guildId });
      if (archived !== undefined) params.set("archived", String(archived));
      return z.array(MeetingTypeSchema).parse(await apiFetch(`/meeting-types?${params}`, token));
    },

    get: async (token: string, id: string): Promise<MeetingType> =>
      MeetingTypeSchema.parse(await apiFetch(`/meeting-types/${id}`, token)),

    update: async (token: string, id: string, dto: UpdateMeetingTypeDto): Promise<MeetingType> =>
      MeetingTypeSchema.parse(await apiFetch(`/meeting-types/${id}`, token, { method: "PATCH", body: JSON.stringify(dto) })),
  },

  meetings: {
    list: async (token: string, guildId: string, status?: MeetingStatus, page = 1): Promise<MeetingsPage> => {
      const params = new URLSearchParams({ guildId, page: String(page) });
      if (status) params.set("status", status);
      return MeetingsPageSchema.parse(await apiFetch(`/meetings?${params}`, token));
    },

    listActive: async (token: string, guildId: string): Promise<Meeting[]> =>
      z.array(MeetingSchema).parse(await apiFetch(`/meetings/active?guildId=${encodeURIComponent(guildId)}`, token)),

    getById: async (token: string, id: string): Promise<Meeting> => MeetingSchema.parse(await apiFetch(`/meetings/${id}`, token)),

    getReport: async (token: string, id: string): Promise<MeetingReport> =>
      MeetingReportSchema.parse(await apiFetch(`/meetings/${id}/report`, token)),

    updateSummary: async (token: string, id: string, dto: UpdateMeetingSummaryDto): Promise<Meeting> =>
      MeetingSchema.parse(await apiFetch(`/meetings/${id}/summary`, token, { method: "PATCH", body: JSON.stringify(dto) })),

    manualCorrection: async (token: string, meetingId: string, dto: ManualAttendanceDto) =>
      apiFetch(`/meetings/${meetingId}/attendance/manual`, token, { method: "POST", body: JSON.stringify(dto) }),
  },

  attendance: {
    update: async (token: string, id: string, dto: UpdateAttendanceDto) =>
      apiFetch(`/attendance/${id}`, token, { method: "PATCH", body: JSON.stringify(dto) }),
  },
};
