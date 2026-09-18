import { DiscordAPIError, type Client } from "discord.js";
import { apiClient } from "./api-client.js";
import { rosterEmbed } from "../ui/embeds/roster.embed.js";
import { logger } from "../logger.js";

/**
 * Discord error codes that mean the tracked channel/message reference is
 * permanently dead (not a transient network blip): the bot lost access to
 * the channel, or the channel/message itself is gone. Retrying these every
 * 60s forever would just spam the log and hit the API for nothing, so on
 * these codes we stop tracking the ref instead of leaving it for the next
 * tick to fail again.
 */
const PERMANENT_ROSTER_ERROR_CODES = new Set([50001, 10003, 10008]);

interface RosterMessageRef {
  channelId: string;
  messageId: string;
  meetingTypeName: string;
}

/**
 * Kept separate from reconciler.ts's voice-tracking map: that one is cleared
 * on pause and re-added on resume (it governs the 60s roster-sync interval),
 * but the public roster message itself should keep existing — and get one
 * more edit reflecting "Paused" — across a pause/resume cycle, not disappear.
 */
const rosterMessages = new Map<string, RosterMessageRef>();
let client: Client | null = null;

export function initRosterMessages(discordClient: Client): void {
  client = discordClient;
}

export function trackRosterMessage(meetingId: string, ref: RosterMessageRef): void {
  rosterMessages.set(meetingId, ref);
}

export function untrackRosterMessage(meetingId: string): void {
  rosterMessages.delete(meetingId);
}

/**
 * Re-fetches the report and edits the tracked message in place. Called from
 * the reconciler's periodic tick while a meeting is ACTIVE, and once
 * immediately from pause/resume/end/cancel so the roster reflects a status
 * change without waiting for the next tick. A missing ref, a deleted
 * message, or a lost permission are all swallowed — a stale or unrefreshed
 * roster message is a display nuisance, not worth failing the caller's
 * actual lifecycle transition over.
 */
export async function refreshRosterMessage(meetingId: string): Promise<void> {
  const ref = rosterMessages.get(meetingId);
  if (!ref || !client) return;

  try {
    const report = await apiClient.meetings.getReport(meetingId);
    const channel = await client.channels.fetch(ref.channelId);
    if (!channel?.isTextBased()) return;

    const message = await channel.messages.fetch(ref.messageId);
    await message.edit({ embeds: [rosterEmbed(ref.meetingTypeName, report)] });
  } catch (error) {
    const code = error instanceof DiscordAPIError ? error.code : undefined;
    logger.warn(
      { err: error, meetingId, channelId: ref.channelId, messageId: ref.messageId, discordErrorCode: code },
      "Failed to refresh the live roster message",
    );

    if (typeof code === "number" && PERMANENT_ROSTER_ERROR_CODES.has(code)) {
      untrackRosterMessage(meetingId);
    }
  }
}
