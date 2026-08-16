import { describe, expect, it } from "vitest";
import { formatDate, formatDuration, formatTime } from "./format-duration.js";

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

describe("formatTime", () => {
  it("formats a UTC time as 24-hour HH:MM", () => {
    expect(formatTime(new Date("2026-08-16T19:02:00Z"))).toBe("19:02");
  });
});

describe("formatDate", () => {
  it("formats a UTC date as DD Mon YYYY", () => {
    expect(formatDate(new Date("2026-08-16T19:00:00Z"))).toBe("16 Aug 2026");
  });
});
