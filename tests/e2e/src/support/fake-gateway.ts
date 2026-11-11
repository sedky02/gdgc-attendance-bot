import { EventEmitter } from "node:events";

export interface FakeMember {
  id: string;
  user: { bot: boolean; username: string };
  displayName: string;
}

export function fakeMember(id: string, displayName: string): FakeMember {
  return { id, user: { bot: false, username: displayName.toLowerCase() }, displayName };
}

/**
 * Stands in for the discord.js Client: one guild with one voice channel whose
 * occupants the test controls. It exposes exactly the surface the bot reads
 * (`guilds`, `channel.members`) and emits `voiceStateUpdate` the way the
 * gateway does, so the bot's real handlers, queue and reconciler run unmodified.
 * A bot that is not running has no listener attached and simply misses the event.
 */
export class FakeGateway extends EventEmitter {
  private readonly occupants = new Map<string, FakeMember>();

  readonly guild: {
    id: string;
    afkChannelId: null;
    channels: { fetch: (channelId: string) => Promise<unknown> };
  };

  readonly guilds: {
    cache: Map<string, unknown>;
    fetch: (guildId: string) => Promise<unknown>;
  };

  constructor(
    readonly guildId: string,
    readonly voiceChannelId: string,
  ) {
    super();
    this.guild = {
      id: guildId,
      afkChannelId: null,
      channels: {
        fetch: async (channelId) =>
          channelId === voiceChannelId ? { isVoiceBased: () => true, members: this.occupants } : null,
      },
    };
    this.guilds = {
      cache: new Map([[guildId, this.guild]]),
      fetch: async (id) => {
        if (id !== guildId) throw new Error(`Unknown guild ${id}`);
        return this.guild;
      },
    };
  }

  get occupantIds(): string[] {
    return [...this.occupants.keys()].sort();
  }

  join(member: FakeMember): void {
    this.occupants.set(member.id, member);
    this.emit(
      "voiceStateUpdate",
      { channelId: null, member, guild: this.guild },
      { channelId: this.voiceChannelId, member, guild: this.guild },
    );
  }

  leave(member: FakeMember): void {
    this.occupants.delete(member.id);
    this.emit(
      "voiceStateUpdate",
      { channelId: this.voiceChannelId, member, guild: this.guild },
      { channelId: null, member, guild: this.guild },
    );
  }
}
