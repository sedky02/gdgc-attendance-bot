import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api-client.js", () => ({
  apiClient: {
    meetings: { sync: vi.fn().mockResolvedValue(undefined) },
    internal: { bootstrap: vi.fn().mockResolvedValue([]) },
  },
}));

import { apiClient } from "./api-client.js";
import { bootstrap, initReconciler, reconcileAll, trackMeeting, untrackMeeting } from "./reconciler.js";

function fakeClient(occupantCount: number, guildIds: string[] = ["guild-1"]) {
  const fakeChannel = {
    isVoiceBased: () => true,
    members: {
      values: () =>
        Array.from({ length: occupantCount }, (_, i) => ({
          id: `user-${i}`,
          user: { bot: false, username: `user${i}` },
          displayName: `User ${i}`,
        }))[Symbol.iterator](),
    },
  };
  const fakeGuild = {
    channels: { fetch: vi.fn().mockResolvedValue(fakeChannel) },
  };
  return {
    guilds: {
      fetch: vi.fn().mockResolvedValue(fakeGuild),
      cache: { has: (id: string) => guildIds.includes(id) },
    },
  } as unknown as import("discord.js").Client;
}

describe("reconciler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(apiClient.meetings.sync).mockClear();
    vi.mocked(apiClient.internal.bootstrap).mockClear();
  });

  afterEach(() => {
    untrackMeeting("meeting-1");
    untrackMeeting("meeting-2");
    vi.useRealTimers();
  });

  it("syncs a tracked meeting with the channel's current occupants every interval", async () => {
    initReconciler(fakeClient(2));
    trackMeeting("meeting-1", "guild-1", ["channel-1"]);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(apiClient.meetings.sync).toHaveBeenCalledWith(
      "meeting-1",
      expect.objectContaining({
        presentMembers: [
          { discordUserId: "user-0", usernameSnapshot: "user0", displayNameSnapshot: "User 0" },
          { discordUserId: "user-1", usernameSnapshot: "user1", displayNameSnapshot: "User 1" },
        ],
      }),
    );
  });

  it("stops syncing once the last tracked meeting is untracked", async () => {
    initReconciler(fakeClient(0));
    trackMeeting("meeting-1", "guild-1", ["channel-1"]);
    untrackMeeting("meeting-1");

    await vi.advanceTimersByTimeAsync(120_000);

    expect(apiClient.meetings.sync).not.toHaveBeenCalled();
  });

  it("reconcileAll can be invoked directly (used by bootstrap for an immediate sync)", async () => {
    initReconciler(fakeClient(0));
    trackMeeting("meeting-1", "guild-1", ["channel-1"]);

    await reconcileAll();

    expect(apiClient.meetings.sync).toHaveBeenCalledTimes(1);
  });

  describe("bootstrap", () => {
    it("adopts only ACTIVE meetings for guilds this process actually serves", async () => {
      vi.mocked(apiClient.internal.bootstrap).mockResolvedValue([
        { id: "meeting-1", guildId: "guild-1", voiceChannelIds: ["channel-1"], status: "ACTIVE" },
        { id: "meeting-2", guildId: "guild-2", voiceChannelIds: ["channel-2"], status: "ACTIVE" }, // different guild
        { id: "meeting-3", guildId: "guild-1", voiceChannelIds: ["channel-3"], status: "PAUSED" }, // paused
      ] as never);

      initReconciler(fakeClient(0, ["guild-1"]));
      await bootstrap();

      expect(apiClient.meetings.sync).toHaveBeenCalledTimes(1);
      expect(apiClient.meetings.sync).toHaveBeenCalledWith("meeting-1", expect.anything());

      untrackMeeting("meeting-3");
    });
  });
});
