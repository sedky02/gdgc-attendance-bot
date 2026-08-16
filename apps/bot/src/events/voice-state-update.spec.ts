import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../services/api-client.js", () => ({
  apiClient: { internal: { voiceEvent: vi.fn().mockResolvedValue(undefined) } },
}));

import { apiClient } from "../services/api-client.js";
import { registerVoiceStateUpdateEvent } from "./voice-state-update.js";

const AFK_CHANNEL_ID = "afk-channel";
const GUILD_ID = "guild-1";

function fakeClient() {
  let handler: ((oldState: unknown, newState: unknown) => void) | undefined;
  return {
    on: (event: string, cb: typeof handler) => {
      if (event === "voiceStateUpdate") handler = cb;
    },
    fire: (oldState: unknown, newState: unknown) => handler?.(oldState, newState),
  };
}

function state(channelId: string | null, overrides: Partial<{ memberId: string; bot: boolean }> = {}) {
  const memberId = overrides.memberId ?? "user-1";
  return {
    channelId,
    guild: { id: GUILD_ID, afkChannelId: AFK_CHANNEL_ID },
    member: {
      id: memberId,
      user: { bot: overrides.bot ?? false, username: "aymen" },
      displayName: "Aymen",
    },
  };
}

describe("voice-state-update", () => {
  beforeEach(() => {
    vi.mocked(apiClient.internal.voiceEvent).mockClear();
  });

  it("ignores bot accounts", async () => {
    const client = fakeClient();
    registerVoiceStateUpdateEvent(client as never);

    client.fire(state(null, { bot: true }), state("channel-a", { bot: true }));
    await new Promise((r) => setTimeout(r, 10));

    expect(apiClient.internal.voiceEvent).not.toHaveBeenCalled();
  });

  it("ignores events where the channel is unchanged (mute/deafen/video toggles)", async () => {
    const client = fakeClient();
    registerVoiceStateUpdateEvent(client as never);

    client.fire(state("channel-a"), state("channel-a"));
    await new Promise((r) => setTimeout(r, 10));

    expect(apiClient.internal.voiceEvent).not.toHaveBeenCalled();
  });

  it("reports a plain join as from: null", async () => {
    const client = fakeClient();
    registerVoiceStateUpdateEvent(client as never);

    client.fire(state(null), state("channel-a"));
    await new Promise((r) => setTimeout(r, 10));

    expect(apiClient.internal.voiceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ from: null, to: "channel-a", guildId: GUILD_ID }),
    );
  });

  it("reports a plain leave as to: null", async () => {
    const client = fakeClient();
    registerVoiceStateUpdateEvent(client as never);

    client.fire(state("channel-a"), state(null));
    await new Promise((r) => setTimeout(r, 10));

    expect(apiClient.internal.voiceEvent).toHaveBeenCalledWith(expect.objectContaining({ from: "channel-a", to: null }));
  });

  it("reports a move between two channels as one event carrying both", async () => {
    const client = fakeClient();
    registerVoiceStateUpdateEvent(client as never);

    client.fire(state("channel-a"), state("channel-b"));
    await new Promise((r) => setTimeout(r, 10));

    expect(apiClient.internal.voiceEvent).toHaveBeenCalledTimes(1);
    expect(apiClient.internal.voiceEvent).toHaveBeenCalledWith(expect.objectContaining({ from: "channel-a", to: "channel-b" }));
  });

  it("treats moving into the AFK channel as a departure", async () => {
    const client = fakeClient();
    registerVoiceStateUpdateEvent(client as never);

    client.fire(state("channel-a"), state(AFK_CHANNEL_ID));
    await new Promise((r) => setTimeout(r, 10));

    expect(apiClient.internal.voiceEvent).toHaveBeenCalledWith(expect.objectContaining({ from: "channel-a", to: null }));
  });

  it("treats moving out of the AFK channel as a fresh join", async () => {
    const client = fakeClient();
    registerVoiceStateUpdateEvent(client as never);

    client.fire(state(AFK_CHANNEL_ID), state("channel-a"));
    await new Promise((r) => setTimeout(r, 10));

    expect(apiClient.internal.voiceEvent).toHaveBeenCalledWith(expect.objectContaining({ from: null, to: "channel-a" }));
  });
});
