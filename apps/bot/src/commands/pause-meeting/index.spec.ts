import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import { data } from "./index.js";

describe("/pause-meeting command", () => {
  it("registers as a slash command named pause-meeting", () => {
    expect(data.toJSON().name).toBe("pause-meeting");
  });

  it("is gated to members who can manage events", () => {
    expect(data.toJSON().default_member_permissions).toBe(PermissionFlagsBits.ManageEvents.toString());
  });
});
