import { describe, expect, it } from "vitest";
import type { MeetingReport } from "@meeting-system/contracts";
import { reportEmbed } from "./report.embed.js";
import { discordTimestamp } from "../../utils/format-duration.js";

function buildReport(overrides: Partial<MeetingReport> = {}): MeetingReport {
  return {
    meeting: {
      id: "meeting-1",
      guildId: "guild-1",
      meetingType: "type-1",
      voiceChannelIds: ["channel-1"],
      status: "COMPLETED",
      startedBy: "manager-1",
      startedAt: new Date("2026-08-16T19:00:00Z"),
      endedBy: "manager-1",
      endedAt: new Date("2026-08-16T20:35:00Z"),
      cancelReason: null,
      pauses: [],
      expectedMembers: [],
      summary: null,
      summaryUpdatedBy: null,
      summaryUpdatedAt: null,
      stats: { presentCount: 2, expectedCount: 3, unexpectedCount: 0, durationMs: 95 * 60 * 1000 },
      createdAt: new Date("2026-08-16T19:00:00Z"),
    },
    attendance: [],
    absentees: [],
    ...overrides,
  };
}

function fieldNamed(embed: ReturnType<typeof reportEmbed>, name: string) {
  return embed.data.fields?.find((field) => field.name === name);
}

describe("reportEmbed", () => {
  it("includes the meeting type name as the title", () => {
    const embed = reportEmbed("Weekly Technical Meeting", buildReport());
    expect(embed.data.title).toBe("📋 Weekly Technical Meeting");
  });

  it("shows the time range and total duration using Discord's own timestamp markup (so it renders in each viewer's local time, matching the embed footer)", () => {
    const embed = reportEmbed("Weekly", buildReport());
    const start = discordTimestamp(new Date("2026-08-16T19:00:00Z"), "t");
    const end = discordTimestamp(new Date("2026-08-16T20:35:00Z"), "t");
    expect(embed.data.description).toContain(`${start} → ${end} · 1h35`);
  });

  it("shows present/expected counts from frozen stats", () => {
    const embed = reportEmbed("Weekly", buildReport());
    expect(embed.data.description).toContain("Present 2/3");
  });

  it("lists each attendee with a green dot, join/leave time, duration, and lateness", () => {
    const report = buildReport({
      attendance: [
        {
          id: "a1",
          meeting: "meeting-1",
          discordUserId: "user-1",
          usernameSnapshot: "ali",
          displayNameSnapshot: "Ali",
          expected: true,
          sessions: [{ joinedAt: new Date("2026-08-16T19:17:00Z"), leftAt: new Date("2026-08-16T20:35:00Z"), source: "EVENT" }],
          manuallyEdited: false,
          editedBy: null,
          stats: {
            firstJoinedAt: new Date("2026-08-16T19:17:00Z"),
            latenessMs: 17 * 60 * 1000,
            totalDurationMs: 78 * 60 * 1000,
            sessionCount: 1,
          },
        },
      ],
    });

    const embed = reportEmbed("Weekly", report);
    const joined = discordTimestamp(new Date("2026-08-16T19:17:00Z"), "t");
    const left = discordTimestamp(new Date("2026-08-16T20:35:00Z"), "t");
    const presentField = fieldNamed(embed, "Present (1)");
    expect(presentField?.value).toBe(`🟡 **Ali**   ${joined} → ${left}   1h18   late 17m`);
  });

  it("marks an attendee with no matching role as unexpected", () => {
    const report = buildReport({
      attendance: [
        {
          id: "a2",
          meeting: "meeting-1",
          discordUserId: "user-2",
          usernameSnapshot: "sami",
          displayNameSnapshot: "Sami",
          expected: false,
          sessions: [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: new Date("2026-08-16T19:10:00Z"), source: "EVENT" }],
          manuallyEdited: false,
          editedBy: null,
          stats: {
            firstJoinedAt: new Date("2026-08-16T19:00:00Z"),
            latenessMs: 0,
            totalDurationMs: 10 * 60 * 1000,
            sessionCount: 1,
          },
        },
      ],
    });

    const embed = reportEmbed("Weekly", report);
    expect(fieldNamed(embed, "Present (1)")?.value).toContain("(unexpected)");
  });

  it("lists absentees with a red dot in a separate field", () => {
    const report = buildReport({
      absentees: [{ discordUserId: "user-3", usernameSnapshot: "ahmed", roleIds: [] }],
    });

    const embed = reportEmbed("Weekly", report);
    expect(fieldNamed(embed, "Absent (1)")?.value).toBe("🔴 ahmed");
  });

  it("omits the Absent field entirely when nobody is absent", () => {
    const embed = reportEmbed("Weekly", buildReport({ absentees: [] }));
    expect(embed.data.fields?.some((field) => field.name.startsWith("Absent"))).toBe(false);
  });
});
