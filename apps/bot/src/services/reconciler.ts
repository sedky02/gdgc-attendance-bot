import type { Client } from "discord.js";
import { apiClient } from "./api-client.js";
import { refreshRosterMessage, untrackRosterMessage } from "./roster-message.js";
import { logger } from "../logger.js";
import { env } from "../config.js";
import { getPresentMembers } from "../utils/present-members.js";

interface TrackedMeeting {
  guildId: string;
  voiceChannelIds: string[];
}

const tracked = new Map<string, TrackedMeeting>();
let client: Client | null = null;
let intervalHandle: NodeJS.Timeout | null = null;

export function initReconciler(discordClient: Client): void {
  client = discordClient;
}

export function trackMeeting(meetingId: string, guildId: string, voiceChannelIds: string[]): void {
  tracked.set(meetingId, { guildId, voiceChannelIds });
  if (!intervalHandle) {
    intervalHandle = setInterval(() => void reconcileAll(), env.RECONCILE_INTERVAL_MS);
  }
}

export function untrackMeeting(meetingId: string): void {
  tracked.delete(meetingId);
  if (tracked.size === 0 && intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/**
 * Every 60s per active meeting, per the reconciler's job. Also the only
 * place that notices a meeting this process still believes is ACTIVE has
 * actually been ended elsewhere — almost always the API's own sweeper
 * auto-ending an abandoned meeting, since every path the bot itself uses to
 * end/pause/cancel a meeting already calls `untrackMeeting` right there.
 * Without this check the roster message would freeze on its last "Live"
 * snapshot forever instead of ever reflecting the real outcome.
 */
export async function reconcileAll(): Promise<void> {
  const observedAt = new Date();

  for (const [meetingId, meeting] of tracked) {
    try {
      const current = await apiClient.meetings.getById(meetingId);
      if (current.status !== "ACTIVE") {
        untrackMeeting(meetingId);
        await refreshRosterMessage(meetingId);
        untrackRosterMessage(meetingId);
        continue;
      }

      const guild = await client?.guilds.fetch(meeting.guildId).catch(() => null);
      if (!guild) continue;
      const presentMembers = await getPresentMembers(guild, meeting.voiceChannelIds);
      await apiClient.meetings.syncAttendance(meetingId, { presentMembers, observedAt });
      await refreshRosterMessage(meetingId);
    } catch (error) {
      logger.warn({ err: error, meetingId }, "Reconciler sync failed");
    }
  }
}

/**
 * Runs at bot startup (and on shard resume): asks the API which meetings are
 * still live, adopts the ones for guilds this process actually serves, and
 * reconciles them immediately rather than waiting for the first interval —
 * this is what lets a dropped session self-correct within one sync instead
 * of up to RECONCILE_INTERVAL_MS late.
 */
export async function bootstrap(): Promise<void> {
  if (!client) return;

  const liveMeetings = await apiClient.internal.bootstrap();

  for (const meeting of liveMeetings) {
    if (meeting.status !== "ACTIVE") continue;
    if (!client.guilds.cache.has(meeting.guildId)) continue;
    trackMeeting(meeting.id, meeting.guildId, meeting.voiceChannelIds);
  }

  await reconcileAll();
}
