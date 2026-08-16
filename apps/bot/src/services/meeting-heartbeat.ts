import type { Client } from "discord.js";
import { apiClient } from "./api-client.js";
import { logger } from "../logger.js";

interface TrackedMeeting {
  guildId: string;
  voiceChannelIds: string[];
}

// Interim polling cadence until Phase 4's reconciler replaces this heuristic
// with real per-user session data (see MeetingSweeperService on the API).
const HEARTBEAT_INTERVAL_MS = 60_000;

const tracked = new Map<string, TrackedMeeting>();
let client: Client | null = null;
let intervalHandle: NodeJS.Timeout | null = null;

export function initMeetingHeartbeat(discordClient: Client): void {
  client = discordClient;
}

export function trackMeeting(meetingId: string, guildId: string, voiceChannelIds: string[]): void {
  tracked.set(meetingId, { guildId, voiceChannelIds });
  if (!intervalHandle) {
    intervalHandle = setInterval(() => void tick(), HEARTBEAT_INTERVAL_MS);
  }
}

export function untrackMeeting(meetingId: string): void {
  tracked.delete(meetingId);
  if (tracked.size === 0 && intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

async function tick(): Promise<void> {
  if (!client) return;
  const observedAt = new Date();

  for (const [meetingId, meeting] of tracked) {
    try {
      const isEmpty = await isChannelSetEmpty(meeting.guildId, meeting.voiceChannelIds);
      await apiClient.meetings.heartbeat(meetingId, isEmpty, observedAt);
    } catch (error) {
      logger.warn({ err: error, meetingId }, "Meeting heartbeat failed");
    }
  }
}

async function isChannelSetEmpty(guildId: string, voiceChannelIds: string[]): Promise<boolean> {
  if (!client) return true;
  const guild = await client.guilds.fetch(guildId);

  for (const channelId of voiceChannelIds) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel?.isVoiceBased()) {
      const humanCount = channel.members.filter((member) => !member.user.bot).size;
      if (humanCount > 0) {
        return false;
      }
    }
  }
  return true;
}
