import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import { data } from "./edit-meeting-type.js";

describe("/edit-meeting-type command", () => {
  it("registers as a slash command named edit-meeting-type", () => {
    expect(data.toJSON().name).toBe("edit-meeting-type");
  });

  it("is gated to members who can manage events", () => {
    expect(data.toJSON().default_member_permissions).toBe(PermissionFlagsBits.ManageEvents.toString());
  });
});
