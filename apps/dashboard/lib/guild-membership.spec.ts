import { describe, expect, it } from "vitest";
import { intersectGuilds, isGuildMember, type DiscordGuild } from "./guild-membership.js";

function guild(id: string, name = id): DiscordGuild {
  return { id, name, icon: null };
}

describe("isGuildMember", () => {
  it("returns true when the guild id is present", () => {
    expect(isGuildMember([guild("1"), guild("2")], "2")).toBe(true);
  });

  it("returns false when the guild id is absent", () => {
    expect(isGuildMember([guild("1")], "2")).toBe(false);
  });
});

describe("intersectGuilds", () => {
  it("keeps only guilds the bot is also in", () => {
    const userGuilds = [guild("1"), guild("2"), guild("3")];
    expect(intersectGuilds(userGuilds, new Set(["2", "3", "4"]))).toEqual([guild("2"), guild("3")]);
  });

  it("returns an empty list when the bot shares no guilds with the user", () => {
    expect(intersectGuilds([guild("1")], new Set(["9"]))).toEqual([]);
  });
});
