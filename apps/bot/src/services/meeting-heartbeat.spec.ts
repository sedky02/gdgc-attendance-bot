import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api-client.js", () => ({
  apiClient: { meetings: { heartbeat: vi.fn() } },
}));

import { apiClient } from "./api-client.js";
import { initMeetingHeartbeat, trackMeeting, untrackMeeting } from "./meeting-heartbeat.js";

function fakeClientWithOccupancy(occupantCount: number) {
  const fakeChannel = {
    isVoiceBased: () => true,
    members: { filter: () => ({ size: occupantCount }) },
  };
  const fakeGuild = {
    channels: { fetch: vi.fn().mockResolvedValue(fakeChannel) },
  };
  return {
    guilds: { fetch: vi.fn().mockResolvedValue(fakeGuild) },
  } as unknown as import("discord.js").Client;
}

describe("meeting heartbeat tracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(apiClient.meetings.heartbeat).mockClear();
  });

  afterEach(() => {
    untrackMeeting("meeting-1");
    untrackMeeting("meeting-2");
    vi.useRealTimers();
  });

  it("reports isEmpty: true when no non-bot member is in the channel", async () => {
    initMeetingHeartbeat(fakeClientWithOccupancy(0));
    trackMeeting("meeting-1", "guild-1", ["channel-1"]);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(apiClient.meetings.heartbeat).toHaveBeenCalledWith("meeting-1", true, expect.any(Date));
  });

  it("reports isEmpty: false when the channel is occupied", async () => {
    initMeetingHeartbeat(fakeClientWithOccupancy(2));
    trackMeeting("meeting-1", "guild-1", ["channel-1"]);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(apiClient.meetings.heartbeat).toHaveBeenCalledWith("meeting-1", false, expect.any(Date));
  });

  it("stops polling once the last tracked meeting is untracked", async () => {
    initMeetingHeartbeat(fakeClientWithOccupancy(0));
    trackMeeting("meeting-1", "guild-1", ["channel-1"]);
    untrackMeeting("meeting-1");

    await vi.advanceTimersByTimeAsync(120_000);

    expect(apiClient.meetings.heartbeat).not.toHaveBeenCalled();
  });

  it("polls multiple tracked meetings independently", async () => {
    initMeetingHeartbeat(fakeClientWithOccupancy(0));
    trackMeeting("meeting-1", "guild-1", ["channel-1"]);
    trackMeeting("meeting-2", "guild-1", ["channel-2"]);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(apiClient.meetings.heartbeat).toHaveBeenCalledWith("meeting-1", true, expect.any(Date));
    expect(apiClient.meetings.heartbeat).toHaveBeenCalledWith("meeting-2", true, expect.any(Date));
  });
});
