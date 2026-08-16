import { describe, expect, it } from "vitest";
import { formatDuration } from "./format.js";

describe("formatDuration", () => {
  it("formats sub-hour durations as minutes", () => {
    expect(formatDuration(35 * 60 * 1000)).toBe("35m");
  });

  it("formats durations over an hour as hHmm", () => {
    expect(formatDuration(95 * 60 * 1000)).toBe("1h35");
  });
});
