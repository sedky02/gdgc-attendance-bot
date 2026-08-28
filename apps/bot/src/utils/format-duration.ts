export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h${minutes.toString().padStart(2, "0")}` : `${minutes}m`;
}

export type DiscordTimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R";

/**
 * Discord's own timestamp markup — the client renders this in *each
 * viewer's* local timezone, client-side. Formatting a time ourselves (e.g.
 * with a fixed `timeZone` option) picks one timezone for everyone, which
 * disagrees with the embed's own footer timestamp (which Discord already
 * auto-localizes) for anyone not in that zone. This is the only way a join
 * time and the embed footer ever agree for a given viewer.
 */
export function discordTimestamp(date: Date, style: DiscordTimestampStyle = "f"): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}
