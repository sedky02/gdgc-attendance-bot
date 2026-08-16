import { z } from "zod";

export const HealthResponseDto = z.object({
  status: z.literal("ok"),
  mongo: z.enum(["connected", "disconnected"]),
  timestamp: z.coerce.date(),
});
export type HealthResponseDto = z.infer<typeof HealthResponseDto>;

export const PingResponseDto = z.object({
  message: z.string(),
  timestamp: z.coerce.date(),
});
export type PingResponseDto = z.infer<typeof PingResponseDto>;
