import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import { data } from "./configure-meeting.js";

describe("/configure-meeting command", () => {
  it("registers as a slash command named configure-meeting", () => {
    expect(data.toJSON().name).toBe("configure-meeting");
  });

  it("is gated to members who can manage events", () => {
    expect(data.toJSON().default_member_permissions).toBe(PermissionFlagsBits.ManageEvents.toString());
  });
});
