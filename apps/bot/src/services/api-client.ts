import { internalApi } from "./api/internal.api.js";
import { meetingsApi } from "./api/meetings.api.js";
import { meetingTypesApi } from "./api/meeting-types.api.js";

export { ApiError } from "./api/http-client.js";

/** Thin facade over the modular per-resource API clients in `./api/`. */
export const apiClient = {
  ping: internalApi.ping,
  meetingTypes: meetingTypesApi,
  meetings: meetingsApi,
  internal: internalApi,
};
