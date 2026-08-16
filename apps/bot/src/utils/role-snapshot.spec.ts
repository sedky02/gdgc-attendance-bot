import { describe, expect, it } from "vitest";
import { rolesToSnapshot } from "./role-snapshot.js";

describe("rolesToSnapshot", () => {
  it("maps a collection of Discord roles to {roleId, nameSnapshot} pairs", () => {
    const roles = new Map([
      ["1", { id: "1", name: "Member" }],
      ["2", { id: "2", name: "Officer" }],
    ]);

    expect(rolesToSnapshot(roles.values())).toEqual([
      { roleId: "1", nameSnapshot: "Member" },
      { roleId: "2", nameSnapshot: "Officer" },
    ]);
  });

  it("returns an empty array when no roles are selected", () => {
    expect(rolesToSnapshot([])).toEqual([]);
  });
});
