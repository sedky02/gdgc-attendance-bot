import {
  CreateMeetingTypeDto,
  MeetingTypeSchema,
  UpdateMeetingTypeDto,
  type MeetingType,
} from "@meeting-system/contracts";
import { z } from "zod";
import { httpClient } from "./http-client.js";

export const meetingTypesApi = {
  list: async (guildId: string, archived?: boolean): Promise<MeetingType[]> => {
    const params = new URLSearchParams({ guildId });
    if (archived !== undefined) {
      params.set("archived", String(archived));
    }
    return z.array(MeetingTypeSchema).parse(await httpClient.get<unknown>(`/meeting-types?${params}`));
  },

  get: async (id: string): Promise<MeetingType> =>
    MeetingTypeSchema.parse(await httpClient.get<unknown>(`/meeting-types/${id}`)),

  create: async (dto: CreateMeetingTypeDto): Promise<MeetingType> =>
    MeetingTypeSchema.parse(await httpClient.post<unknown>("/meeting-types", dto)),

  update: async (id: string, dto: UpdateMeetingTypeDto): Promise<MeetingType> =>
    MeetingTypeSchema.parse(await httpClient.patch<unknown>(`/meeting-types/${id}`, dto)),

  archive: async (id: string): Promise<MeetingType> =>
    MeetingTypeSchema.parse(await httpClient.delete<unknown>(`/meeting-types/${id}`)),
};
