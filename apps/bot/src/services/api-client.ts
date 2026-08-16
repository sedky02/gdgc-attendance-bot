import {
  CreateMeetingTypeDto,
  MeetingTypeSchema,
  PingResponseDto,
  UpdateMeetingTypeDto,
  type MeetingType,
} from "@meeting-system/contracts";
import { z } from "zod";
import { env } from "../config.js";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  retries?: number;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries only on network failure or 5xx — a 4xx means the request itself
 * is wrong and retrying it changes nothing.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, retries = MAX_RETRIES } = options;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const response = await fetch(`${env.API_BASE_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Service-Token": env.BOT_SERVICE_TOKEN,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status >= 500) {
        throw new ApiError(`API responded ${response.status}`, response.status);
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ message: response.statusText }))) as {
          message?: string;
        };
        throw new ApiError(payload.message ?? "Request failed", response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      const isRetryable = !(error instanceof ApiError) || error.status >= 500;
      if (!isRetryable || attempt === retries) {
        throw error;
      }
      await sleep(BASE_DELAY_MS * 2 ** attempt);
      attempt += 1;
    }
  }

  throw lastError;
}

export const apiClient = {
  ping: async () => PingResponseDto.parse(await request<unknown>("/internal/ping")),

  meetingTypes: {
    list: async (guildId: string, archived?: boolean): Promise<MeetingType[]> => {
      const params = new URLSearchParams({ guildId });
      if (archived !== undefined) {
        params.set("archived", String(archived));
      }
      return z.array(MeetingTypeSchema).parse(await request<unknown>(`/meeting-types?${params}`));
    },

    get: async (id: string): Promise<MeetingType> =>
      MeetingTypeSchema.parse(await request<unknown>(`/meeting-types/${id}`)),

    create: async (dto: CreateMeetingTypeDto): Promise<MeetingType> =>
      MeetingTypeSchema.parse(await request<unknown>("/meeting-types", { method: "POST", body: dto })),

    update: async (id: string, dto: UpdateMeetingTypeDto): Promise<MeetingType> =>
      MeetingTypeSchema.parse(await request<unknown>(`/meeting-types/${id}`, { method: "PATCH", body: dto })),

    archive: async (id: string): Promise<MeetingType> =>
      MeetingTypeSchema.parse(await request<unknown>(`/meeting-types/${id}`, { method: "DELETE" })),
  },
};
