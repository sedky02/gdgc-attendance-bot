import { describe, expect, it } from "vitest";
import { isGuildMember } from "./guild-membership.js";

describe("isGuildMember", () => {
  it("returns true when the guild id is present", () => {
    expect(isGuildMember([{ id: "1" }, { id: "2" }], "2")).toBe(true);
  });

  it("returns false when the guild id is absent", () => {
    expect(isGuildMember([{ id: "1" }], "2")).toBe(false);
  });
});
