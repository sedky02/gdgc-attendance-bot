import { describe, expect, it } from "vitest";
import { chunkLines, fitLines } from "./embed-limits.js";

describe("fitLines", () => {
  it("returns every line when they fit", () => {
    expect(fitLines(["a", "b"], 10)).toEqual(["a", "b"]);
  });

  it("replaces what does not fit with a count, and stays within the limit", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `member-${i}`);
    const fitted = fitLines(lines, 100);

    expect(fitted.join("\n").length).toBeLessThanOrEqual(100);
    expect(fitted.at(-1)).toBe(`… and ${50 - (fitted.length - 1)} more`);
  });
});

describe("chunkLines", () => {
  it("splits on line boundaries so no chunk exceeds the limit", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line number ${i}`);
    const chunks = chunkLines(lines, 100);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 100)).toBe(true);
    expect(chunks.join("\n").split("\n")).toEqual(lines);
  });
});
