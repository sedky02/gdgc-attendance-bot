import { describe, expect, it } from "vitest";
import type { Meeting, MeetingReport } from "@meeting-system/contracts";
import { rosterEmbed } from "./roster.embed.js";

function buildReport(overrides: Partial<MeetingReport> = {}, meetingOverrides: Partial<Meeting> = {}): MeetingReport {
  return {
    meeting: {
      id: "meeting-1",
      guildId: "guild-1",
      meetingType: "type-1",
      voiceChannelIds: ["channel-1"],
      status: "ACTIVE",
      startedBy: "manager-1",
      startedAt: new Date("2026-08-16T19:00:00Z"),
      endedBy: null,
      endedAt: null,
      cancelReason: null,
      pauses: [],
      expectedMembers: [],
      summary: null,
      summaryUpdatedBy: null,
      summaryUpdatedAt: null,
      stats: null,
      createdAt: new Date("2026-08-16T19:00:00Z"),
      ...meetingOverrides,
    },
    attendance: [],
    absentees: [],
    ...overrides,
  };
}

describe("rosterEmbed", () => {
  it("includes the meeting type name as the title", () => {
    const embed = rosterEmbed("Weekly Technical Meeting", buildReport());
    expect(embed.data.title).toBe("Weekly Technical Meeting");
  });

  it("shows a green dot for someone who joined on time", () => {
    const report = buildReport({
      attendance: [
        {
          id: "a1",
          meeting: "meeting-1",
          discordUserId: "user-1",
          usernameSnapshot: "ali",
          displayNameSnapshot: "Ali",
          expected: true,
          sessions: [{ joinedAt: new Date("2026-08-16T19:00:00Z"), leftAt: null, source: "EVENT" }],
          manuallyEdited: false,
          editedBy: null,
          stats: { firstJoinedAt: new Date("2026-08-16T19:00:00Z"), latenessMs: 0, totalDurationMs: 60_000, sessionCount: 1 },
        },
      ],
    });

    const embed = rosterEmbed("Weekly", report);
    expect(embed.data.description).toContain("🟢 Ali");
  });

  it("shows a yellow dot and the lateness for someone who joined after the meeting started", () => {
    const report = buildReport({
      attendance: [
        {
          id: "a2",
          meeting: "meeting-1",
          discordUserId: "user-2",
          usernameSnapshot: "sami",
          displayNameSnapshot: "Sami",
          expected: true,
          sessions: [{ joinedAt: new Date("2026-08-16T19:17:00Z"), leftAt: null, source: "EVENT" }],
          manuallyEdited: false,
          editedBy: null,
          stats: {
            firstJoinedAt: new Date("2026-08-16T19:17:00Z"),
            latenessMs: 17 * 60 * 1000,
            totalDurationMs: 60_000,
            sessionCount: 1,
          },
        },
      ],
    });

    const embed = rosterEmbed("Weekly", report);
    expect(embed.data.description).toContain("🟡 Sami");
    expect(embed.data.description).toContain("late 17m");
  });

  it("shows a red dot for an absentee", () => {
    const report = buildReport({
      absentees: [{ discordUserId: "user-3", usernameSnapshot: "ahmed", roleIds: [] }],
    });

    const embed = rosterEmbed("Weekly", report);
    expect(embed.data.description).toContain("🔴 ahmed   absent");
  });

  it("says nobody has joined yet when attendance is empty", () => {
    const embed = rosterEmbed("Weekly", buildReport());
    expect(embed.data.description).toContain("Nobody has joined yet");
  });

  it("reflects PAUSED status in the header and uses a different color than ACTIVE", () => {
    const active = rosterEmbed("Weekly", buildReport({}, { status: "ACTIVE" }));
    const paused = rosterEmbed("Weekly", buildReport({}, { status: "PAUSED" }));

    expect(paused.data.description).toContain("Paused");
    expect(paused.data.color).not.toBe(active.data.color);
  });
});
