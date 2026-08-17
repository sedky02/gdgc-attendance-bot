import { z } from "zod";

/**
 * Returned by write endpoints whose only meaningful outcome is "the API took
 * it" — the voice-event and roster-sync paths, where the resolver may
 * legitimately decide the call is a no-op (meeting paused, event stale) and
 * the caller has nothing to do about it either way.
 */
export const AcknowledgedResponseDto = z.object({
  acknowledged: z.literal(true),
});
export type AcknowledgedResponseDto = z.infer<typeof AcknowledgedResponseDto>;
