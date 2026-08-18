import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import { data } from "./index.js";

describe("/start-meeting command", () => {
  it("registers as a slash command named start-meeting", () => {
    expect(data.toJSON().name).toBe("start-meeting");
  });

  it("is gated to members who can manage events", () => {
    expect(data.toJSON().default_member_permissions).toBe(PermissionFlagsBits.ManageEvents.toString());
  });
});
