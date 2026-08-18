import { describe, expect, it } from "vitest";
import { data } from "./index.js";

describe("/meeting-status command", () => {
  it("registers as a slash command named meeting-status", () => {
    expect(data.toJSON().name).toBe("meeting-status");
  });

  it("is available to anyone, unlike the manager-only lifecycle commands", () => {
    expect(data.toJSON().default_member_permissions).toBeUndefined();
  });
});
