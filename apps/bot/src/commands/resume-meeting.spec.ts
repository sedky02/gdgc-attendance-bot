import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import { data } from "./resume-meeting.js";

describe("/resume-meeting command", () => {
  it("registers as a slash command named resume-meeting", () => {
    expect(data.toJSON().name).toBe("resume-meeting");
  });

  it("is gated to members who can manage events", () => {
    expect(data.toJSON().default_member_permissions).toBe(PermissionFlagsBits.ManageEvents.toString());
  });
});
