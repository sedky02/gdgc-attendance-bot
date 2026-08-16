import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import { data } from "./end-meeting.js";

describe("/end-meeting command", () => {
  it("registers as a slash command named end-meeting", () => {
    expect(data.toJSON().name).toBe("end-meeting");
  });

  it("is gated to members who can manage events", () => {
    expect(data.toJSON().default_member_permissions).toBe(PermissionFlagsBits.ManageEvents.toString());
  });
});
