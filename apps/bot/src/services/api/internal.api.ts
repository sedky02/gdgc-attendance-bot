import { MeetingSchema, PingResponseDto, VoiceEventDto, type Meeting } from "@meeting-system/contracts";
import { z } from "zod";
import { httpClient } from "./http-client.js";

export const internalApi = {
  ping: async () => PingResponseDto.parse(await httpClient.get<unknown>("/internal/ping")),

  voiceEvent: async (dto: VoiceEventDto): Promise<void> => {
    await httpClient.post<unknown>("/internal/voice-events", dto);
  },

  bootstrap: async (): Promise<Meeting[]> =>
    z.array(MeetingSchema).parse(await httpClient.post<unknown>("/internal/bootstrap")),
};
