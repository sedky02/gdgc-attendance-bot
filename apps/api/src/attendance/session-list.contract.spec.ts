import { describe, expect, it } from "vitest";
import { UpdateAttendanceDto } from "@meeting-system/contracts";

const at = (time: string) => `2026-08-16T${time}:00Z`;
const parse = (sessions: { joinedAt: string; leftAt: string | null }[]) =>
  UpdateAttendanceDto.safeParse({
    sessions: sessions.map((session) => ({ ...session, source: "MANUAL" })),
    editedBy: "lead",
  });

describe("manual session list validation", () => {
  it("accepts chronological sessions with an open one at the end", () => {
    const result = parse([
      { joinedAt: at("19:00"), leftAt: at("19:30") },
      { joinedAt: at("19:30"), leftAt: at("20:00") },
      { joinedAt: at("20:10"), leftAt: null },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects a session that ends before it starts", () => {
    const result = parse([{ joinedAt: at("20:00"), leftAt: at("19:00") }]);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("A session cannot end before it starts");
  });

  it("rejects overlapping or out-of-order sessions", () => {
    expect(
      parse([
        { joinedAt: at("19:00"), leftAt: at("20:00") },
        { joinedAt: at("19:30"), leftAt: at("20:30") },
      ]).success,
    ).toBe(false);
  });

  it("rejects an open session that is not the last one", () => {
    expect(
      parse([
        { joinedAt: at("19:00"), leftAt: null },
        { joinedAt: at("19:30"), leftAt: at("20:00") },
      ]).success,
    ).toBe(false);
  });
});
