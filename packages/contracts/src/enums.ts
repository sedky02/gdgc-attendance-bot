import { z } from "zod";

export const MeetingStatus = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]);
export type MeetingStatus = z.infer<typeof MeetingStatus>;

export const SessionSource = z.enum(["EVENT", "SYNC", "MANUAL"]);
export type SessionSource = z.infer<typeof SessionSource>;

export const ResolvePresenceScope = z.enum(["FULL", "PARTIAL"]);
export type ResolvePresenceScope = z.infer<typeof ResolvePresenceScope>;
