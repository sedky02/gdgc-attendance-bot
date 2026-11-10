import { describe, expect, it } from "vitest";
import { trustedActor } from "./trusted-actor.util.js";

describe("trustedActor", () => {
  it("uses the JWT identity and ignores whatever the dashboard request body claims", () => {
    const user = { discordUserId: "1", username: "aymen", guildId: "g", roleIds: [] };
    expect(trustedActor(user, "someone-else")).toBe("aymen");
  });

  it("accepts the claimed actor from the service-token caller, which carries no JWT", () => {
    expect(trustedActor(undefined, "manager-1")).toBe("manager-1");
  });
});
