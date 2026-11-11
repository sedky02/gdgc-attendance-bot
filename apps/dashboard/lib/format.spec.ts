import { describe, expect, it } from "vitest";
import { formatDuration } from "./format.js";

describe("formatDuration", () => {
  it("shows a non-zero duration under a minute as <1m rather than 0m", () => {
    expect(formatDuration(9_000)).toBe("<1m");
    expect(formatDuration(0)).toBe("0m");
  });

  it("formats sub-hour durations as minutes", () => {
    expect(formatDuration(35 * 60 * 1000)).toBe("35m");
  });

  it("formats durations over an hour as hHmm", () => {
    expect(formatDuration(95 * 60 * 1000)).toBe("1h35");
  });
});
