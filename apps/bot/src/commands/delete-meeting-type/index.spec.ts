import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionFlagsBits } from "discord.js";

const { list, archive, promptMeetingTypeSelect } = vi.hoisted(() => ({
  list: vi.fn(),
  archive: vi.fn(),
  promptMeetingTypeSelect: vi.fn(),
}));

vi.mock("../../services/api-client.js", () => ({ apiClient: { meetingTypes: { list, archive } } }));
vi.mock("../../ui/selects/meeting-type-select-prompt.js", () => ({ promptMeetingTypeSelect }));

import { data, execute } from "./index.js";

const meetingType = { id: "type-1", guildId: "guild-1", name: "Weekly Technical Meeting", roles: [], archived: false };

function fakeInteraction() {
  return {
    inGuild: () => true,
    guildId: "guild-1",
    deferred: true,
    replied: false,
    deferReply: vi.fn(),
    editReply: vi.fn(),
    reply: vi.fn(),
  };
}

describe("/delete-meeting-type command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers as a slash command named delete-meeting-type", () => {
    expect(data.toJSON().name).toBe("delete-meeting-type");
  });

  it("is gated to members who can manage events", () => {
    expect(data.toJSON().default_member_permissions).toBe(PermissionFlagsBits.ManageEvents.toString());
  });

  it("archives the selected meeting type through the API and confirms it", async () => {
    const update = vi.fn();
    list.mockResolvedValue([meetingType]);
    promptMeetingTypeSelect.mockResolvedValue({ values: ["type-1"], update });
    archive.mockResolvedValue({ ...meetingType, archived: true });

    await execute(fakeInteraction() as never);

    expect(list).toHaveBeenCalledWith("guild-1", false);
    expect(archive).toHaveBeenCalledWith("type-1");
    expect(update.mock.calls[0][0].embeds[0].data.title).toBe('Deleted "Weekly Technical Meeting"');
  });

  it("archives nothing when the guild has no meeting types", async () => {
    list.mockResolvedValue([]);

    await execute(fakeInteraction() as never);

    expect(promptMeetingTypeSelect).not.toHaveBeenCalled();
    expect(archive).not.toHaveBeenCalled();
  });
});
