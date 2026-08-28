import { describe, expect, it } from "vitest";
import { discordTimestamp, formatDuration } from "./format-duration.js";

describe("formatDuration", () => {
  it("formats sub-hour durations as minutes", () => {
    expect(formatDuration(35 * 60 * 1000)).toBe("35m");
  });

  it("formats durations over an hour as hHmm", () => {
    expect(formatDuration(95 * 60 * 1000)).toBe("1h35");
  });

  it("pads single-digit minutes", () => {
    expect(formatDuration(65 * 60 * 1000)).toBe("1h05");
  });
});

describe("discordTimestamp", () => {
  it("renders Discord's <t:seconds:style> markup, defaulting to style f", () => {
    const date = new Date("2026-08-16T19:02:00Z");
    expect(discordTimestamp(date)).toBe(`<t:${Math.floor(date.getTime() / 1000)}:f>`);
  });

  it("uses the requested style", () => {
    const date = new Date("2026-08-16T19:02:00Z");
    expect(discordTimestamp(date, "t")).toBe(`<t:${Math.floor(date.getTime() / 1000)}:t>`);
  });
});
